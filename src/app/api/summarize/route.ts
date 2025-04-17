import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { Anthropic } from "@llamaindex/anthropic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { years } = await request.json();

    if (!years || typeof years !== 'object') {
      return NextResponse.json(
        { error: "Invalid input format" },
        { status: 400 }
      );
    }

    // Format the risks data for the prompt
    const risksText = Object.entries(years)
      .map(([year, risks]) => {
        const risksList = (risks as Array<{ category: string; description: string }>)
          .map(risk => `- ${risk.category}: ${risk.description}`)
          .join('\n');
        return `Year ${year}:\n${risksList}`;
      })
      .join('\n\n');

    const prompt = `
Here are the risks identified in various fiscal years:

${risksText}

Please analyze these risks and provide a summary of the the risks have changed over time.

1. Identify risks that have stayed consistently present
2. Identify risks that are no longer mentioned
3. Mention new risks that have emerged

Be very specific about the risks and also very concise in the description of each risk,
something like:

<h2>Ongoing risks:</h2>
<ul>
  <li>Legal regulations</li>
  <li>Supply chain disruptions</li>
</ul>

<h2>Risks no longer mentioned:</h2>
<ul>
  <li>....</li>
</ul>

<h2>New risks that have emerged:</h2>
<ul>
  <li>....</li>
</ul>

The summary should be in basic HTML as shown here, so that we can display it directly without having to parse Markdown.
`;

    const llm = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      model: "claude-3-7-sonnet-latest"
    });

    let response = await llm.complete({
      prompt: prompt,
    });

    const summary = response.text

    console.log(summary);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error generating summary" },
      { status: 500 }
    );
  }
} 
