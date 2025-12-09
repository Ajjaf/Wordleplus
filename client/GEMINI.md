# Client-Side Rules & Guidelines

## Technology Stack

- **Framework**: React 18.2+ with functional components and hooks
- **Build Tool**: Vite 5+
- **Styling**: TailwindCSS 3.4+ with custom design system
- **Animations**: Framer Motion 12+
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Real-time**: Socket.IO Client 4.7+
- **State Management**: React Context + Hooks (no Redux)

## Project Structure

```
client/src/
├── components/       # Reusable UI components
│   ├── ui/         # Base UI components (buttons, cards, etc.)
│   ├── layout/     # Layout components (GameLayout, etc.)
│   ├── features/   # Feature-specific components
│   ├── mobile/     # Mobile-specific components
│   └── player/     # Player-related components
├── screens/        # Full-page screen components
├── hooks/          # Custom React hooks
├── modes/          # Game mode modules (actions, selectors)
├── contexts/       # React Context providers
├── config/         # Configuration files
├── lib/            # Utility functions
└── utils/          # Helper utilities
```

## Component Development Rules

### Component Structure

1. **Functional Components Only**: No class components
2. **Hooks First**: Use hooks for state and side effects
3. **Composition Over Inheritance**: Build complex UIs from simple components
4. **Single Responsibility**: Each component should do one thing well

### Component Patterns

```jsx
// Good: Functional component with hooks
function PlayerCard({ name, wins, streak }) {
  const isMobile = useIsMobile();
  const [isActive, setIsActive] = useState(false);

  return (
    <Card className={cn("p-4", isActive && "ring-2")}>{/* content */}</Card>
  );
}

// Export with memo for performance
export default memo(PlayerCard);
```

### Props & State

1. **Props**: Use destructuring, provide defaults, validate with PropTypes or JSDoc
2. **State**: Prefer `useState` for simple state, `useReducer` for complex state
3. **Derived State**: Compute from props/state rather than storing duplicates
4. **Lifting State**: Lift state to the nearest common ancestor

### Hooks Rules

1. **Custom Hooks**: Extract reusable logic into hooks (prefix with `use`)
2. **Hook Dependencies**: Always include all dependencies in dependency arrays
3. **Hook Order**: Hooks must be called in the same order every render
4. **Conditional Hooks**: Never call hooks conditionally

### Styling Guidelines

1. **TailwindCSS**: Use Tailwind utility classes, avoid inline styles when possible
2. **Design System**: Use design tokens from `design-system.js` and `mode-themes.js`
3. **Responsive**: Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
4. **Dark Mode**: Support dark mode via CSS variables
5. **Custom Classes**: Use `cn()` utility for conditional classes

```jsx
// Good: Using Tailwind with conditional classes
<div className={cn(
  "p-4 rounded-lg",
  isActive && "ring-2 ring-primary",
  isMobile ? "text-sm" : "text-base"
)}>
```

### Component Organization

1. **File Naming**: Match component name to file name (`PlayerCard.jsx` → `PlayerCard`)
2. **Exports**: Use default exports for components
3. **Imports**: Group imports (React, third-party, local, relative)
4. **File Size**: Keep components under 300 lines; split if larger

### Performance Optimization

1. **Memoization**: Use `React.memo()` for components that re-render frequently
2. **useMemo/useCallback**: Use for expensive computations and function references
3. **Code Splitting**: Lazy load routes and heavy components
4. **Image Optimization**: Use appropriate image formats and sizes

```jsx
// Memoize expensive components
export default memo(PlayerCard);

// Memoize expensive computations
const filteredPlayers = useMemo(
  () => players.filter((p) => p.active),
  [players]
);

// Memoize callbacks
const handleClick = useCallback(() => {
  // handler
}, [dependencies]);
```

## Game Mode Architecture

### Mode Module Structure

Each game mode has:

- `actions.js`: Action creators for mode-specific actions
- `selectors.js`: Selectors for deriving state
- `index.js`: Exports and mode configuration

### Screen Components

1. **Naming**: `{Mode}GameScreen.jsx` (e.g., `DuelGameScreen.jsx`)
2. **Layout**: Use `GameLayout` component for consistent structure
3. **State**: Derive state from room/player data, minimal local state
4. **Effects**: Handle side effects (particles, animations) in screen components

### Real-time Updates

1. **Socket.IO**: Use `useSocketConnection` hook for socket management
2. **Event Handlers**: Handle socket events in screen components or custom hooks
3. **State Sync**: Always sync with server state, don't maintain parallel state
4. **Optimistic Updates**: Use sparingly, always reconcile with server

## Mobile Considerations

### Responsive Design

1. **Mobile-First**: Design for mobile first, enhance for desktop
2. **Breakpoints**: Use `useIsMobile()` hook (default: 768px)
3. **Touch Targets**: Minimum 44x44px for touch targets
4. **Swipe Gestures**: Use `useSwipeGestures` hook for swipe interactions

### Mobile Components

1. **MobileBoard**: Use for mobile board display
2. **MicroProgressGrid**: Compact progress visualization
3. **MobilePlayerProgressCard**: Compact player cards
4. **Virtual Keyboard**: Always show keyboard on mobile for text input

### Performance on Mobile

1. **Bundle Size**: Keep mobile bundle small
2. **Lazy Loading**: Lazy load heavy components
3. **Image Optimization**: Use responsive images
4. **Animation**: Use `will-change` sparingly, prefer transforms

## UI/UX Guidelines

### User Feedback

1. **Loading States**: Show loading indicators for async operations
2. **Error Messages**: Display user-friendly error messages
3. **Success Feedback**: Provide visual feedback for successful actions
4. **Animations**: Use subtle animations for state changes

### Accessibility

1. **ARIA Labels**: Add aria-labels to interactive elements
2. **Keyboard Navigation**: Support keyboard navigation
3. **Focus Management**: Manage focus for modals and dialogs
4. **Color Contrast**: Ensure WCAG AA contrast ratios

### Design System

1. **Colors**: Use theme colors from `mode-themes.js`
2. **Typography**: Use consistent typography scale
3. **Spacing**: Use Tailwind spacing scale consistently
4. **Components**: Reuse UI components from `components/ui/`

## Common Patterns

### Form Handling

```jsx
const [value, setValue] = useState("");
const [error, setError] = useState("");

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validate(value)) {
    setError("Invalid input");
    return;
  }
  await onSubmit(value);
};
```

### API Calls

```jsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const handleAction = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await apiCall();
    // handle success
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Context Usage

```jsx
// Create context
const GameContext = createContext();

// Provide context
<GameContext.Provider value={gameState}>{children}</GameContext.Provider>;

// Use context
const { room, me } = useContext(GameContext);
```

## Testing Considerations

1. **Component Testing**: Test component rendering and interactions
2. **Hook Testing**: Test custom hooks in isolation
3. **Integration Testing**: Test screen components with mock data
4. **E2E Testing**: Test complete user flows

## Build & Development

1. **Development**: `npm run dev` (Vite dev server)
2. **Build**: `npm run build` (production build)
3. **Preview**: `npm run preview` (preview production build)
4. **Environment**: Use `.env` for environment variables

## Common Pitfalls to Avoid

1. **Don't mutate state directly**: Always use setState/useState
2. **Don't forget dependencies**: Include all dependencies in useEffect
3. **Don't create components in render**: Move component definitions outside
4. **Don't use index as key**: Use stable, unique keys
5. **Don't ignore warnings**: Fix React warnings and errors
