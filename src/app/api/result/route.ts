import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const LLAMA_CLOUD_API_URL = "https://api.cloud.llamaindex.ai/api/v1";
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;

async function getJobResult(jobId: string) {
  const response = await fetch(`${LLAMA_CLOUD_API_URL}/extraction/jobs/${jobId}/result`, {
    headers: {
      Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get job result: ${response.statusText}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: "No jobId provided" },
        { status: 400 }
      );
    }

    const result = await getJobResult(jobId);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error getting job result:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error getting job result" },
      { status: 500 }
    );
  }
} 
