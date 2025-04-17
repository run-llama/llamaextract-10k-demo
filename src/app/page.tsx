"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import "./globals.css";

interface Document {
  id: string;
  filename: string;
  status: "processing" | "completed" | "error";
  jobId?: string;
  result?: any;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newDocuments = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      status: "processing" as const,
    }));

    setDocuments((prev) => [...prev, ...newDocuments]);

    // Process each file
    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await axios.post("/api/process", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const jobId = response.data.jobId;
        
        // Update document with jobId
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.filename === file.name ? { ...doc, jobId } : doc
          )
        );

        // Poll for results
        const pollInterval = setInterval(async () => {
          try {
            const resultResponse = await axios.get(`/api/status?jobId=${jobId}`);
            const { status, error } = resultResponse.data;

            if (status === "SUCCESS") {
              clearInterval(pollInterval);
              // Fetch the actual results from the result endpoint
              const resultsResponse = await axios.get(`/api/result?jobId=${jobId}`);
              setDocuments((prev) =>
                prev.map((doc) =>
                  doc.jobId === jobId
                    ? { ...doc, status: "completed", result: resultsResponse.data.result }
                    : doc
                )
              );
            } else if (status === "FAILED" || error) {
              clearInterval(pollInterval);
              setDocuments((prev) =>
                prev.map((doc) =>
                  doc.jobId === jobId ? { ...doc, status: "error" } : doc
                )
              );
            }
          } catch (error) {
            clearInterval(pollInterval);
            setDocuments((prev) =>
              prev.map((doc) =>
                doc.jobId === jobId ? { ...doc, status: "error" } : doc
              )
            );
          }
        }, 2000); // Poll every 2 seconds

        // Cleanup interval after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
      } catch (error) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.filename === file.name ? { ...doc, status: "error" } : doc
          )
        );
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
    },
  });

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="auth-page">
        <a href="/auth/signin" className="auth-button">
          Sign in to continue
        </a>
      </div>
    );
  }

  return (
    <main className="document-page">
      <div className="container">
        <div className="document-header">
          <h1 className="document-title">Document Processing</h1>
          <div className="user-info">
            <span className="user-name">
              Welcome, {session.user?.name}
            </span>
            <img
              src={session.user?.image || ""}
              alt="Profile"
              className="user-avatar"
            />
            <button 
              onClick={() => window.location.href = '/api/auth/signout'}
              className="logout-button"
            >
              Logout
            </button>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`document-dropzone ${isDragActive ? "document-dropzone-active" : ""}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the files here ...</p>
          ) : (
            <p>Drag and drop files here, or click to select files</p>
          )}
        </div>

        <div>
          <h2 className="document-title">Processing Status</h2>
          <div className="document-table-container">
            <table className="document-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.filename}</td>
                    <td>
                      <span className={`status-badge ${doc.status}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>
                      {doc.status === "completed" && doc.result && (
                        <details>
                          <summary>View JSON</summary>
                          <pre className="json-details">
                            {JSON.stringify(doc.result, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {documents.some(doc => doc.status === "completed" && doc.result) && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="document-title">Risks</h2>
              <button 
                onClick={async () => {
                  const risksByYear = documents
                    .filter(doc => doc.status === "completed" && doc.result)
                    .reduce((acc, doc) => {
                      const year = doc.result.data.filingInfo.fiscalYear;
                      acc[year] = doc.result.data.keyRisks.map((risk: any) => ({
                        category: risk.category,
                        description: risk.description
                      }));
                      return acc;
                    }, {} as Record<string, Array<{ category: string; description: string }>>);

                  try {
                    setIsSummarizing(true);
                    const response = await axios.post('/api/summarize', {
                      years: risksByYear
                    });
                    setSummary(response.data.summary);
                  } catch (error) {
                    console.error('Error summarizing risks:', error);
                  } finally {
                    setIsSummarizing(false);
                  }
                }}
                className="summarize-button"
                disabled={isSummarizing}
              >
                Summarize
                {isSummarizing && (
                  <span className="spinner" />
                )}
              </button>
            </div>
            {summary && (
              <div className="summary-box" dangerouslySetInnerHTML={{ __html: summary }} />
            )}
            <div className="document-table-container">
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Fiscal Year</th>
                    <th>Risks</th>
                  </tr>
                </thead>
                <tbody>
                  {documents
                    .filter(doc => doc.status === "completed" && doc.result)
                    .sort((a, b) => {
                      const yearA = parseInt(a.result.data.filingInfo.fiscalYear);
                      const yearB = parseInt(b.result.data.filingInfo.fiscalYear);
                      return yearB - yearA;
                    })
                    .map(doc => (
                      <tr key={doc.id}>
                        <td>{doc.result.data.filingInfo.fiscalYear}</td>
                        <td>
                          <table className="nested-table">
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {doc.result.data.keyRisks.map((risk: any, index: number) => (
                                <tr key={index}>
                                  <td>{risk.category}</td>
                                  <td 
                                    title={risk.description}
                                    data-full-description={risk.description}
                                  >
                                    {risk.description.length > 100 
                                      ? `${risk.description.substring(0, 100)}...`
                                      : risk.description}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
