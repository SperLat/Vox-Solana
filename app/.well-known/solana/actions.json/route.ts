import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    rules: [
      {
        pathPattern: "/api/actions/**",
        apiPath: "/api/actions/**"
      }
    ]
  });
}
