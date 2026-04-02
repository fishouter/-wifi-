import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RouterNode {
  id: string;
  x: number; // 0-100
  y: number; // 0-100
  type?: 'standard' | 'high-power' | 'mesh' | 'fttr-main' | 'fttr-sub' | 'ftto-main' | 'ftto-sub';
  locationDescription?: string;
}

export interface AnalysisResult {
  recommendedCount: number;
  routers: RouterNode[];
  equipment: string;
  explanation: {
    priority: string;
    strategy: string;
    summary: string;
  };
  solution?: {
    networkingPlan: string;
    packageRecommendation: string;
    tariffDescription: string;
    equipmentCost?: string;
    competitorAdvantage?: string;
    comprehensiveSolution: string;
  };
  widthMeters?: number;
  lengthMeters?: number;
  areaSquareMeters?: number;
}

export async function analyzeFloorPlan(
  imageBase64: string, 
  mimeType: string, 
  scenario: 'home' | 'enterprise' = 'home',
  modelType: 'gemini-flash' | 'gemini-pro' | 'qwen' = 'gemini-flash',
  enterpriseName: string = '',
  userFeedback: string = '',
  previousResult: any = null,
  currentWidthMeters?: number,
  planTier: 'economical' | 'standard' | 'premium' = 'standard',
  mainPrice: number = 1299,
  subPrice: number = 499
): Promise<AnalysisResult> {
  let prompt = `你是一个专业的WiFi网络部署专家和建筑图纸分析师。请分析这张${scenario === 'enterprise' ? '政企/园区/办公区' : '家庭'}户型图。`;

  if (currentWidthMeters) {
    prompt += `\n已知该户型的物理宽度约为 ${currentWidthMeters.toFixed(1)} 米，请以此为基准进行覆盖范围的计算和分析。`;
  }

  if (enterpriseName) {
    prompt += `\n本次服务的客户是：【${enterpriseName}】，请在解决方案中体现定制化。`;
  }

  const tierDescriptions = {
    'economical': '【经济实惠型】方案：请尽量减少路由器数量，保证基本覆盖即可，突出性价比和成本控制。',
    'standard': '【均衡标准型】方案：请平衡覆盖效果和成本，提供常规的优质推荐。',
    'premium': '【极致性能型】方案：请提供无死角、高密度的全覆盖方案，可适当增加节点，突出极致体验、高并发和稳定性。'
  };
  prompt += `\n\n当前客户选择的是${tierDescriptions[planTier]}`;

  if (userFeedback && previousResult) {
    prompt += `\n\n【用户反馈与调整要求】\n用户对之前的方案提出了以下修改意见："${userFeedback}"\n请**严格遵照**用户的意见进行修改！例如，如果用户要求增加或减少路由器数量，你必须在返回的 \`routers\` 数组中增加或减少相应的节点，并更新 \`recommendedCount\`。如果用户要求更改设备，请更新 \`equipment\`。`;
  }

  prompt += `\n\n1. 根据房屋的结构、墙体分布和预估面积，给出最优的WiFi路由器部署方案，以实现无死角覆盖。
${scenario === 'enterprise' ? '【企业模式要求】\n- 请推荐联通FTTO企业级组网设备。\n- 路由器的数量和配置必须以“N主N从”（例如：1主3从）的专业方式进行说明，填入equipment字段。\n- **注意：企业模式下，起码要有一个主设备（主路由），routers数组中必须至少包含一个type为ftto-main的节点。从路由必须为ftto-sub。**\n- 部署方案解析需要突出规划重点（如：核心覆盖区、高密接入区、无缝漫游设计等），适合政企客户汇报。' : '【家庭模式要求】\n- 请推荐适合家庭的常规路由器设备（如Wi-Fi 6/7 路由器或家用Mesh）。\n- 部署方案解析需要通俗易懂，说明覆盖重点。'}
2. 仔细观察图纸上是否有尺寸标注，或者根据常规户型比例估算。返回该户型的整体物理宽度（widthMeters）、长度（lengthMeters）和面积（areaSquareMeters）。如果不确定，可以给出合理的预估值。
3. 生成【智能化解决方案】(solution字段)，包含组网方案(networkingPlan)、套餐推荐(packageRecommendation)、资费说明(tariffDescription)、建议增加设备的价格预估(equipmentCost)、与竞品的优势(competitorAdvantage)和综合解决方案说明(comprehensiveSolution)。
   - **重要资费要求**：已知主路由单价为 ${mainPrice} 元，从路由单价为 ${subPrice} 元。请在“资费说明(tariffDescription)”中简单明了地说明计费规则，避免与其他字段内容重复。在“设备价格预估(equipmentCost)”中，严格根据你推荐的主路由和从路由数量，使用这两个单价来计算**设备总价**（设备总价 = 主路由数量 * 主路由单价 + 从路由数量 * 从路由单价），确保金额与施工方案完全匹配！并补充说明“具体套餐优惠以实际选择的缴费周期为准”。
4. 为每个路由器节点提供语义化的位置说明（locationDescription），例如“客厅中心，覆盖主要活动区域”、“会议室顶部，满足高密接入”等。

请返回一个JSON对象，包含以下字段：
{
  "recommendedCount": 推荐的路由器总数量（整数）,
  "equipment": "${scenario === 'enterprise' ? '1主N从 (联通FTTO...)' : '推荐的家庭路由器型号或类型'}",
  "routers": [{"x": 50, "y": 50, "type": "standard", "locationDescription": "客厅中心，覆盖主要活动区域"}], // x和y代表在图纸上的百分比位置，0-100的数字。家庭模式type可以是'standard', 'high-power', 'mesh'。政企模式type必须是'ftto-main'(主路由), 'ftto-sub'(从路由)。
  "explanation": {
    "priority": "规划重点说明（核心覆盖区、高密接入等）",
    "strategy": "部署策略说明（点位选择原因、漫游设计等）",
    "summary": "整体总结"
  },
  "solution": {
    "networkingPlan": "具体的组网技术方案说明",
    "packageRecommendation": "推荐的宽带/专线套餐及价格（如：联通千兆政企专线 299元/月）",
    "tariffDescription": "预估的资费说明（要求：简单明了，避免与套餐推荐和设备价格重复，直接给出总价和计费逻辑，严格控制在500字以内）",
    "equipmentCost": "建议增加设备的价格预估（如：FTTO主网关xxx元，从网关xxx元/台）",
    "competitorAdvantage": "与竞品（如传统AC+AP或普通Mesh）相比的优势",
    "comprehensiveSolution": "综合说明（要求：必须包含合作条款、施工周期、售后服务等企业相关信息，简单扼要，严格控制在200字以内）",
    "keyMetrics": [
      {"label": "覆盖率", "value": "99%", "trend": "up", "trendValue": "15%"},
      {"label": "预计施工周期", "value": "3天", "trend": "down", "trendValue": "2天"}
    ], // 提取2-4个核心数据指标，用于顶部卡片展示。trend可以是"up"或"down"。
    "radarData": [
      {"subject": "覆盖范围", "A": 98, "B": 75, "fullMark": 100},
      {"subject": "稳定性", "A": 95, "B": 60, "fullMark": 100},
      {"subject": "性价比", "A": 90, "B": 70, "fullMark": 100},
      {"subject": "施工服务", "A": 95, "B": 50, "fullMark": 100},
      {"subject": "美观度", "A": 90, "B": 60, "fullMark": 100}
    ] // 与传统方案的雷达图对比数据数组，包含5个维度。A代表本方案得分，B代表传统方案得分。
  },
  "widthMeters": 物理宽度（米，数字）,
  "lengthMeters": 物理长度（米，数字）,
  "areaSquareMeters": 物理面积（平方米，数字）
}
必须严格返回合法的JSON格式，不要包含其他多余的文本或Markdown标记。
**极其重要：请确保返回的JSON格式绝对正确！所有的字符串值内部如果需要使用引号，请务必使用单引号（'）或者中文引号（“”），绝对不要使用未转义的英文双引号（"），否则会导致JSON解析失败！**`;

  let text = "{}";

  if (modelType === 'qwen') {
    try {
      const qwenUrl = import.meta.env.VITE_QWEN_URL;
      const qwenApiKey = import.meta.env.VITE_QWEN_API_KEY;
      const qwenModel = import.meta.env.VITE_QWEN_MODEL || "qwen-vl-plus";

      if (!qwenUrl || !qwenApiKey) {
        throw new Error("Qwen API配置缺失，请检查环境变量。");
      }

      // Determine if the URL is Anthropic compatible or OpenAI compatible based on the URL path
      const isAnthropic = qwenUrl.includes('anthropic');

      if (isAnthropic) {
      const response = await fetch(qwenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': qwenApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: qwenModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: imageBase64
                  }
                },
                {
                  type: "text",
                  text: prompt
                }
              ]
            }
          ],
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Qwen API Error: ${response.status} ${errText}. Falling back to Gemini.`);
        throw new Error(`Qwen API Error: ${response.status}`);
      }

      const data = await response.json();
      text = data.content?.[0]?.text || "{}";
    } else {
      // Fallback to OpenAI format
      const response = await fetch(qwenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenApiKey}`
        },
        body: JSON.stringify({
          model: qwenModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Qwen API Error: ${response.status} ${errText}. Falling back to Gemini.`);
        throw new Error(`Qwen API Error: ${response.status}`);
      }

      const data = await response.json();
      text = data.choices?.[0]?.message?.content || "{}";
    }

    } catch (e) {
      console.warn("Qwen API failed, falling back to Gemini.", e);
      modelType = 'gemini-flash'; // Fallback to Gemini
    }
  }

  if (modelType !== 'qwen') {
    // Gemini
    try {
      const modelName = modelType === 'gemini-pro' ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      const response = await ai.models.generateContent({
        model: modelName,
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
              equipment: { type: Type.STRING },
              routers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    type: { type: Type.STRING },
                    locationDescription: { type: Type.STRING }
                  },
                  required: ["x", "y", "type"]
                }
              },
              explanation: { 
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING },
                  strategy: { type: Type.STRING },
                  summary: { type: Type.STRING }
                },
                required: ["priority", "strategy", "summary"]
              },
              solution: {
                type: Type.OBJECT,
                properties: {
                  networkingPlan: { type: Type.STRING },
                  packageRecommendation: { type: Type.STRING },
                  tariffDescription: { type: Type.STRING },
                  equipmentCost: { type: Type.STRING },
                  competitorAdvantage: { type: Type.STRING },
                  comprehensiveSolution: { type: Type.STRING },
                  radarData: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        subject: { type: Type.STRING },
                        A: { type: Type.NUMBER },
                        B: { type: Type.NUMBER },
                        fullMark: { type: Type.NUMBER }
                      },
                      required: ["subject", "A", "B", "fullMark"]
                    }
                  }
                }
              },
              widthMeters: { type: Type.NUMBER },
              lengthMeters: { type: Type.NUMBER },
              areaSquareMeters: { type: Type.NUMBER }
            },
            required: ["recommendedCount", "equipment", "routers", "explanation", "widthMeters", "lengthMeters", "areaSquareMeters"]
          }
        }
      });
      text = response.text || "{}";
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      throw new Error(`AI 模型调用失败。可能是网络连接问题或跨域限制。详细错误: ${e.message || String(e)}`);
    }
  }

  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Find the first '{' and last '}' to extract JSON in case of extra text
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  if (startIndex !== -1 && endIndex !== -1) {
    text = text.substring(startIndex, endIndex + 1);
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error("JSON Parse Error. Raw text:", text);
    console.error(parseError);
    
    // Attempt some basic auto-fixing for common LLM JSON mistakes
    try {
      // 1. Replace unescaped newlines within strings
      let fixedText = text.replace(/(?<=:\s*")([^"]*)(?=")/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      });
      // 2. Try to fix unescaped quotes inside strings (very basic heuristic)
      // This is risky but might save a slightly malformed JSON
      fixedText = fixedText.replace(/([^\\])"([^,}\]\s])/g, '$1\\"$2');
      
      return JSON.parse(fixedText);
    } catch (secondError) {
      throw new Error(`AI 返回的数据格式有误，无法解析。请重试或修改提示词。详细错误: ${parseError}`);
    }
  }
}
