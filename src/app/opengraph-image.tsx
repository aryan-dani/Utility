import { ImageResponse } from "next/og";

export const alt = "Utility OS — MIT-WPU study workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          color: "#fafafa",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "#a1a1aa" }}>
          MIT-WPU
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, lineHeight: 1 }}>Utility</div>
          <div style={{ marginTop: 24, fontSize: 36, color: "#d4d4d8" }}>
            Academic workspace for your semester
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa" }}>
          Syllabus · Resources · Planner · Ask AI
        </div>
      </div>
    ),
    { ...size },
  );
}
