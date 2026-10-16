import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export function flameIcon(px: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#ff7a1a,#e11d48)" }}>
        <svg width={px * 0.62} height={px * 0.62} viewBox="0 0 24 24">
          <path fill="#fff" d="M12 2c1 3.5-1.5 5.5-3 7.5C7.6 11.4 7 13 7 14.5 7 18 9.2 21 12 21s5-2.6 5-6c0-2.2-1-3.8-2-5 .1 1.6-.5 2.8-1.6 3.3.4-3.7-.6-8-1.4-11.3z" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}

export default function Icon() {
  return flameIcon(512);
}
