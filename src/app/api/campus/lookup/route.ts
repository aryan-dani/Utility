import { NextResponse } from "next/server";
import {
  getFacultySeating,
  getHomeCampusData,
  isIshaniConfigured,
} from "@/lib/ishani";

export const revalidate = 86400;

/** Small public campus index for the command palette. Cached at the CDN. */
export async function GET() {
  if (!isIshaniConfigured()) {
    return NextResponse.json(
      { staff: [], seats: [], labs: [] },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  }
  const [home, seats] = await Promise.all([
    getHomeCampusData(),
    getFacultySeating(),
  ]);
  return NextResponse.json(
    {
      staff: home.staff.slice(0, 400).map((member) => ({
        name: member.name || "",
        designation: member.designation || "",
        group: member.facultyGroup || "",
      })),
      seats: seats.slice(0, 400).map((seat) => ({
        name: seat.Name_of_Faculty || "",
        seat: seat.Seating_ID || "",
        department: seat.Department || "",
      })),
      labs: home.infrastructure.slice(0, 80).map((lab) => ({
        name: lab.labName || "",
        room: lab.roomNo || "",
        floor: lab.floor || "",
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
  );
}
