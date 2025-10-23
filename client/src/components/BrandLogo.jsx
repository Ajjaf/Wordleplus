import React from "react";
import logoImage from "../assets/download.png";

export default function BrandLogo({
  withText = true,
  size = "md",
  className = "",
  textClassName = "",
}) {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-10 w-10 md:h-12 md:w-12",
    lg: "h-14 w-14 md:h-16 md:w-16",
    xl: "h-20 w-20 md:h-24 md:w-24",
  };

  const textSizeMap = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
    xl: "text-2xl",
  };

  const imageSizeClass = sizeMap[size] ?? sizeMap.md;
  const textSizeClass = textSizeMap[size] ?? textSizeMap.md;

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <img
        src={logoImage}
        alt="EvoWordo logo"
        className={`${imageSizeClass} rounded-xl object-cover shadow-md`}
      />
      {withText && (
        <span
          className={`${textSizeClass} font-extrabold tracking-tight text-slate-900 dark:text-slate-100 ${textClassName}`.trim()}
        >
          EvoWordo
        </span>
      )}
    </div>
  );
}
