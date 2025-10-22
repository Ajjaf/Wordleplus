import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import memoize from "memoizee";
import { PrismaClient } from "@prisma/client";
import { mergeAnonymousUser, mergeAnonymousUserIntoExisting } from "./mergeService.js";

const prisma = new PrismaClient();

if (!process.env.REPLIT_DOMAINS) {
  console.warn("REPLIT_DOMAINS not set - auth may not work in deployment");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "user_sessions", // Different from our Session model to avoid conflicts
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(user, tokens) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertAuthenticatedUser(claims, anonymousUserId) {
  const authExternalId = claims["sub"];
  
  // Check if this Replit user already exists
  let user = await prisma.user.findUnique({
    where: { authExternalId }
  });

  if (user) {
    // User exists - check if they have new anonymous progress to merge
    if (anonymousUserId && anonymousUserId !== user.id) {
      const anonUser = await prisma.user.findUnique({
        where: { id: anonymousUserId }
      });
      
      if (anonUser && anonUser.isAnonymous) {
        // Merge anonymous progress into existing authenticated account
        console.log(`[AUTH] Merging anonymous user ${anonymousUserId} into existing account ${user.id}`);
        await mergeAnonymousUserIntoExisting(anonymousUserId, user.id);
      }
    }
    
    // Update account info
    return await prisma.user.update({
      where: { id: user.id },
      data: {
        email: claims["email"],
        displayName: `${claims["first_name"] || ""} ${claims["last_name"] || ""}`.trim() || null,
        avatarUrl: claims["profile_image_url"],
        isAnonymous: false,
      }
    });
  }

  // New authenticated user - check if we need to merge anonymous account
  if (anonymousUserId) {
    const anonUser = await prisma.user.findUnique({
      where: { id: anonymousUserId }
    });
    
    if (anonUser && anonUser.isAnonymous) {
      // Merge the anonymous user into the new authenticated user
      user = await mergeAnonymousUser(anonymousUserId, {
        authProvider: "replit",
        authExternalId,
        email: claims["email"],
        displayName: `${claims["first_name"] || ""} ${claims["last_name"] || ""}`.trim() || null,
        avatarUrl: claims["profile_image_url"],
        isAnonymous: false,
      });
      return user;
    }
  }

  // Create new authenticated user (no anonymous account to merge)
  user = await prisma.user.create({
    data: {
      authProvider: "replit",
      authExternalId,
      email: claims["email"],
      displayName: `${claims["first_name"] || ""} ${claims["last_name"] || ""}`.trim() || null,
      avatarUrl: claims["profile_image_url"],
      isAnonymous: false,
    }
  });

  return user;
}

export async function setupAuth(app) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify = async (tokens, verified) => {
    const user = {};
    updateUserSession(user, tokens);
    
    // Get anonymous userId from session if exists
    const anonymousUserId = verified.req?.session?.anonymousUserId;
    const dbUser = await upsertAuthenticatedUser(tokens.claims(), anonymousUserId);
    
    // Store the database user ID in the session
    user.dbUserId = dbUser.id;
    user.dbUser = dbUser;
    
    // Clear anonymous session after successful merge
    if (verified.req?.session) {
      delete verified.req.session.anonymousUserId;
    }
    
    verified(null, user);
  };

  // Setup passport strategies for each domain
  const domains = process.env.REPLIT_DOMAINS?.split(",") || ["localhost"];
  for (const domain of domains) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
        passReqToCallback: true,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));

  // Login route
  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // OAuth callback
  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/",
    })(req, res, next);
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

// Middleware to check if user is authenticated (optional - doesn't block anonymous)
export const isAuthenticated = async (req, res, next) => {
  const user = req.user;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  // Try to refresh the token
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Get user ID from request (supports both anonymous and authenticated)
export function getUserIdFromRequest(req) {
  // Check if authenticated user
  if (req.user?.dbUserId) {
    return req.user.dbUserId;
  }
  
  // Check for anonymous session
  if (req.session?.anonymousUserId) {
    return req.session.anonymousUserId;
  }
  
  // Fallback to header (for iframe environments)
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId) {
    return headerUserId;
  }
  
  // Fallback to cookie
  return req.cookies?.dailyUserId || null;
}
