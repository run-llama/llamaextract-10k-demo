import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const LLAMA_CLOUD_API_URL = "https://api.cloud.llamaindex.ai/api/v1";
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;

async function getJobStatus(jobId: string) {
  const response = await fetch(`${LLAMA_CLOUD_API_URL}/extraction/jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
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

    const jobStatus = await getJobStatus(jobId);

    console.log(jobStatus);

    return NextResponse.json({
      status: jobStatus.status,
      result: jobStatus.status === "SUCCESS" ? jobStatus.result : null,
      error: jobStatus.status === "FAILED" ? "Extraction job failed" : null
    });
  } catch (error) {
    console.error("Error getting job status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error getting job status" },
      { status: 500 }
    );
  }
} 
