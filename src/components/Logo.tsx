import Image from "next/image";

const sizes = {
  sm: 48,
  md: 80,
  lg: 120,
} as const;

export function Logo({
  size = "md",
  className = "",
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  return (
    <Image
      src="/logo.png"
      alt="Al-Yumn Goat Farm"
      width={px}
      height={px}
      priority={size !== "sm"}
      className={`h-auto w-auto ${className}`}
      style={{ width: px, height: "auto" }}
    />
  );
}
