import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const LLAMA_CLOUD_API_URL = "https://api.cloud.llamaindex.ai/api/v1";
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const LLAMA_EXTRACT_AGENT_ID = process.env.LLAMA_EXTRACT_AGENT_ID;

async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("upload_file", file);

  const response = await fetch(`${LLAMA_CLOUD_API_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }

  return response.json();
}

async function createExtractionJob(fileId: string) {
  const response = await fetch(`${LLAMA_CLOUD_API_URL}/extraction/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
    body: JSON.stringify({
      extraction_agent_id: LLAMA_EXTRACT_AGENT_ID,
      file_id: fileId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create extraction job: ${response.statusText}`);
  }

  return response.json();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Upload file to LlamaExtract
    const uploadResponse = await uploadFile(file);
    const fileId = uploadResponse.id;

    // Create extraction job
    const jobResponse = await createExtractionJob(fileId);

    return NextResponse.json({
      filename: file.name,
      jobId: jobResponse.id
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error processing file" },
      { status: 500 }
    );
  }
} 
