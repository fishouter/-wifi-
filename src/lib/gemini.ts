import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RouterNode {
  id: string;
  x: number; // 0-100
  y: number; // 0-100
  type?: 'standard' | 'high-power' | 'mesh';
}

export interface AnalysisResult {
  recommendedCount: number;
  routers: RouterNode[];
  explanation: string;
}

export async function analyzeFloorPlan(imageBase64: string, mimeType: string): Promise<AnalysisResult> {
  const prompt = `你是一个专业的WiFi网络部署专家。请分析这张户型图（可能是家庭或办公场所）。
根据房屋的结构、墙体分布和预估面积，给出最优的WiFi路由器部署方案，以实现全屋无死角覆盖。
请返回一个JSON对象，包含以下字段：
{
  "recommendedCount": 推荐的路由器数量（整数）,
  "routers": [{"x": 50, "y": 50, "type": "standard"}], // x和y代表在图纸上的百分比位置，0-100的数字。type可以是'standard'(标准路由), 'high-power'(穿墙路由), 或 'mesh'(Mesh节点)。
  "explanation": "详细的中文解释，说明为什么这样部署，考虑了哪些结构因素（如承重墙、走廊、主要活动区域等），以及为什么选择特定的路由器类型。"
}
必须严格返回合法的JSON格式，不要包含其他多余的文本或Markdown标记。`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        }
      },
      prompt
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedCount: { type: Type.INTEGER },
          routers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                type: { type: Type.STRING }
              },
              required: ["x", "y", "type"]
            }
          },
          explanation: { type: Type.STRING }
        },
        required: ["recommendedCount", "routers", "explanation"]
      }
    }
  });

  let text = response.text || "{}";
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
}
