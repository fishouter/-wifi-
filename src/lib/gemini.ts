import { GoogleGenAI, Type } from "@google/genai";

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
    comprehensiveSolution: string;
    keyMetrics?: { label: string; value: string; trend?: string; trendValue?: string }[];
    radarData?: { subject: string; A: number; B: number; fullMark: number }[];
    donutData?: { name: string; value: number }[];
    donutDescription?: string;
    barData?: { name: string; value: number }[];
    barDescription?: string;
  };
  widthMeters?: number;
  lengthMeters?: number;
  areaSquareMeters?: number;
}

export async function generateFloorPlanImage(
  description: string,
  photoBase64?: string,
  photoMimeType?: string
): Promise<{ imageUrl: string, widthMeters?: number }> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is not set in the environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Extract dimensions from description
  let widthMeters: number | undefined = undefined;
  try {
    const extractResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract the physical dimensions from this floor plan description: "${description}". 
      Return ONLY a JSON object with a "widthMeters" number field representing the physical width of the floor plan in meters. 
      If only area is provided (e.g., 100 sqm), estimate the width assuming a 4:3 aspect ratio (e.g., sqrt(100 * 4/3) ≈ 11.5).
      If no dimensions are mentioned, return an empty object {}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            widthMeters: { type: Type.NUMBER }
          }
        }
      }
    });
    const extracted = JSON.parse(extractResponse.text || "{}");
    if (extracted.widthMeters) {
      widthMeters = extracted.widthMeters;
    }
  } catch (e) {
    console.error("Failed to extract dimensions", e);
  }

  const parts: any[] = [];

  if (photoBase64 && photoMimeType) {
    parts.push({
      inlineData: {
        data: photoBase64.split(',')[1] || photoBase64,
        mimeType: photoMimeType
      }
    });
  }

  parts.push({ text: `Generate a professional, clean, top-down 2D floor plan blueprint based on this description: ${description}. The floor plan should have clear walls, doors, and basic furniture layouts. Use a clean architectural style. IMPORTANT: Any text labels in the image MUST use a standard sans-serif font like Microsoft YaHei (微软雅黑). Do NOT use handwriting, cursive, or artistic fonts for text.` });

  let response;
  let retries = 2;
  while (retries >= 0) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "4:3",
            imageSize: "2K"
          }
        }
      });
      break;
    } catch (err: any) {
      console.warn(`2K generation failed, retries left: ${retries}`, err);
      if (retries === 0) {
        throw err;
      }
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        imageUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
        widthMeters
      };
    }
  }

  throw new Error("Failed to generate floor plan image.");
}
export async function editFloorPlanImage(
  description: string,
  combinedImageBase64: string,
  mimeType: string = 'image/png',
  aspectRatio: string = '4:3'
): Promise<{ imageUrl: string, widthMeters?: number }> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is not set in the environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Extract dimensions from description
  let widthMeters: number | undefined = undefined;
  try {
    const extractResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract the physical dimensions from this edit description: "${description}". 
      Return ONLY a JSON object with a "widthMeters" number field representing the physical width of the floor plan in meters. 
      If only area is provided (e.g., 100 sqm), estimate the width assuming a 4:3 aspect ratio (e.g., sqrt(100 * 4/3) ≈ 11.5).
      If no dimensions are mentioned, return an empty object {}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            widthMeters: { type: Type.NUMBER }
          }
        }
      }
    });
    const extracted = JSON.parse(extractResponse.text || "{}");
    if (extracted.widthMeters) {
      widthMeters = extracted.widthMeters;
    }
  } catch (e) {
    console.error("Failed to extract dimensions", e);
  }

  const parts: any[] = [
    {
      inlineData: {
        data: combinedImageBase64.split(',')[1] || combinedImageBase64,
        mimeType: mimeType
      }
    },
    { 
      text: `Modify the image based on this request: "${description}". The red areas in the image indicate the specific region to be modified. Keep the rest of the image exactly the same. IMPORTANT: If you add any text labels, they MUST use a standard sans-serif font like Microsoft YaHei (微软雅黑). Do NOT use handwriting, cursive, or artistic fonts for text.` 
    }
  ];

  let response;
  let retries = 2;
  while (retries >= 0) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "2K"
          }
        }
      });
      break;
    } catch (err: any) {
      console.warn(`2K editing failed, retries left: ${retries}`, err);
      if (retries === 0) {
        throw err;
      }
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        imageUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
        widthMeters
      };
    }
  }

  throw new Error("Failed to edit floor plan image.");
}
export async function analyzeFloorPlan(
  imageBase64: string, 
  mimeType: string, 
  scenario: 'home' | 'enterprise' | 'office' | 'hotel' | 'shop' | 'hospital' = 'home',
  modelType: 'gemini-flash' | 'gemini-pro' | 'qwen' = 'gemini-flash',
  enterpriseName: string = '',
  userFeedback: string = '',
  previousResult: any = null,
  currentWidthMeters?: number,
  planTier: 'economical' | 'standard' | 'premium' = 'standard',
  mainPrice: number = 1299,
  subPrice: number = 499
): Promise<AnalysisResult> {
  const scenarioNames = {
    'home': '家庭',
    'enterprise': '政企/园区',
    'office': '写字楼/办公区',
    'hotel': '酒店',
    'shop': '商铺',
    'hospital': '医院'
  };
  const scenarioName = scenarioNames[scenario] || '家庭';

  let prompt = `你是一个专业的WiFi网络部署专家和建筑图纸分析师。请分析这张${scenarioName}户型图。`;

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
  // We always request premium from AI now to cache it, and derive others client-side
  prompt += `\n\n当前客户选择的是【极致性能型】方案：请提供无死角、高密度的全覆盖方案，可适当增加节点，突出极致体验、高并发和稳定性。`;

  if (userFeedback) {
    if (previousResult) {
      prompt += `\n\n【用户反馈与调整要求】\n用户对之前的方案提出了以下修改意见："${userFeedback}"\n请**严格遵照**用户的意见进行修改！例如，如果用户要求增加或减少路由器数量，你必须在返回的 \`routers\` 数组中增加或减少相应的节点，并更新 \`recommendedCount\`。如果用户要求更改设备，请更新 \`equipment\`。如果用户明确提供了面积（如3000平米）或尺寸，请务必直接使用客户提供的面积和尺寸数据，不要自己估算。
**重要选型建议要求**：如果客户在反馈中强制要求了较少的设备数量（例如“只要20个设备”），但根据你评估的面积（如3000平米）和墙体结构，这个数量会导致覆盖率严重不足、存在大量信号盲区，请在 \`equipment\` 字段中除了说明当前配置的设备外，**必须额外补充一段选型建议**，明确指出当前设备数量覆盖不足，并给出**建议优化后的设备数量**（例如：“当前配置20台设备存在覆盖盲区，为达到无死角覆盖，建议优化至35台设备”）。`;
    } else {
      prompt += `\n\n【客户特殊诉求】\n客户提出了以下特殊要求："${userFeedback}"\n请在设计方案时**严格遵照**客户的上述要求！如果客户在反馈中明确提供了面积（如3000平米）或尺寸，请务必直接使用客户提供的面积和尺寸数据，不要自己估算。
**重要选型建议要求**：如果客户在反馈中强制要求了较少的设备数量（例如“只要20个设备”），但根据你评估的面积（如3000平米）和墙体结构，这个数量会导致覆盖率严重不足、存在大量信号盲区，请在 \`equipment\` 字段中除了说明当前配置的设备外，**必须额外补充一段选型建议**，明确指出当前设备数量覆盖不足，并给出**建议优化后的设备数量**（例如：“当前配置20台设备存在覆盖盲区，为达到无死角覆盖，建议优化至35台设备”）。`;
    }
  }

  prompt += `\n\n1. 根据房屋的结构、墙体分布和预估面积，给出最优的WiFi路由器部署方案，以实现无死角覆盖。**重要：户型图周边非室内的区域（如室外、走廊外、非家庭/办公区），不要覆盖信号，也不要在这些区域放置路由器，避免浪费。**
${scenario !== 'home' ? '【政企/商业模式要求】\n- 请推荐联通FTTO企业级组网设备。\n- 路由器的数量和配置必须以“N主N从”（例如：1主3从）的专业方式进行说明，填入equipment字段。\n- **注意：企业模式下，起码要有一个主设备（主路由），routers数组中必须至少包含一个type为ftto-main的节点。从路由必须为ftto-sub。**\n- 部署方案解析需要突出规划重点（如：核心覆盖区、高密接入区、无缝漫游设计等），适合政企客户汇报。' : '【家庭模式要求】\n- 请推荐适合家庭的常规路由器设备（如Wi-Fi 6/7 路由器或家用Mesh）。\n- 部署方案解析需要通俗易懂，说明覆盖重点。'}
2. 仔细观察图纸上是否有尺寸标注，或者根据常规户型比例估算。返回该户型的整体物理宽度（widthMeters）、长度（lengthMeters）和面积（areaSquareMeters）。**重要：如果客户在反馈中提供了面积，请务必以客户提供的面积为准（areaSquareMeters），并根据面积合理反推长宽。**
3. 生成【智能化解决方案】(solution字段)，包含组网方案(networkingPlan)、套餐推荐(packageRecommendation)和综合解决方案说明(comprehensiveSolution)。
**重要要求：综合解决方案说明(comprehensiveSolution)必须是一篇500字左右的详细综述，请使用Markdown格式排版，必须包含以下四个明确的段落标题（如 ### 1. 整体分析）：1. 整体分析；2. 方案优势对比；3. 竞品分析说明（与移动、电信等友商方案的对比）；4. 商机跟踪说明。**
4. 为每个路由器节点提供语义化的位置说明（locationDescription），例如“客厅中心，覆盖主要活动区域”、“会议室顶部，满足高密接入”等。

请返回一个JSON对象，包含以下字段：
{
  "recommendedCount": 推荐的路由器总数量（整数）,
  "equipment": "${scenario !== 'home' ? '1主N从 (联通FTTO...)' : '推荐的家庭路由器型号或类型'}",
  "routers": [{"x": 50, "y": 50, "type": "standard", "locationDescription": "客厅中心，覆盖主要活动区域"}], // x和y代表在图纸上的百分比位置，0-100的数字。家庭模式type可以是'standard', 'high-power', 'mesh'。政企商业模式type必须是'ftto-main'(主路由), 'ftto-sub'(从路由)。
  "explanation": {
    "priority": "规划重点说明（核心覆盖区、高密接入等）",
    "strategy": "部署策略说明（点位选择原因、漫游设计等）",
    "summary": "整体总结"
  },
  "solution": {
    "networkingPlan": "具体的组网技术方案说明",
    "packageRecommendation": "推荐的宽带/专线套餐及价格（如：联通千兆政企专线 299元/月）",
    "comprehensiveSolution": "综合说明（必须是一篇500字左右的详细综述，请使用Markdown格式排版，必须包含以下四个明确的段落标题（如 ### 1. 整体分析）：1. 整体分析；2. 方案优势对比；3. 竞品分析说明（与移动、电信等友商方案的对比）；4. 商机跟踪说明。）",
    "keyMetrics": [
      {"label": "覆盖率", "value": "99%", "trend": "up", "trendValue": "15%"},
      {"label": "预计施工周期", "value": "3天", "trend": "down", "trendValue": "2天"},
      {"label": "并发终端数", "value": "120台", "trend": "up", "trendValue": "50%"},
      {"label": "网络延迟", "value": "<10ms", "trend": "down", "trendValue": "30%"}
    ], // 必须提取4个核心数据指标，用于顶部卡片展示。trend可以是"up"或"down"。
    "radarData": [
      {"subject": "覆盖范围", "A": 98, "B": 75, "fullMark": 100},
      {"subject": "稳定性", "A": 95, "B": 60, "fullMark": 100},
      {"subject": "性价比", "A": 90, "B": 70, "fullMark": 100},
      {"subject": "施工服务", "A": 95, "B": 50, "fullMark": 100},
      {"subject": "美观度", "A": 90, "B": 60, "fullMark": 100}
    ], // 与传统方案的雷达图对比数据数组，包含5个维度。A代表本方案得分，B代表传统方案得分。
    "donutData": [
      {"name": "传统专线", "value": 40},
      {"name": "5G专网", "value": 35},
      {"name": "云业务", "value": 25}
    ], // 业务收入结构构成或类似维度的饼图数据
    "donutDescription": "饼图数据的文字说明，解释其含义（50字以内）",
    "barData": [
      {"name": "工业互联网", "value": 50},
      {"name": "政务云项目", "value": 30}
    ], // 核心潜在商机预测金额或类似维度的柱状图数据
    "barDescription": "柱状图数据的文字说明，解释其含义（50字以内）"
  },
  "widthMeters": 物理宽度（米，数字）,
  "lengthMeters": 物理长度（米，数字）,
  "areaSquareMeters": 物理面积（平方米，数字）
}
必须严格返回合法的JSON格式，不要包含其他多余的文本或Markdown标记。
**极其重要：请确保返回的JSON格式绝对正确！所有的字符串值内部如果需要使用引号，请务必使用单引号（'）或者中文引号（“”），绝对不要使用未转义的英文双引号（"），否则会导致JSON解析失败！**
**警告：严禁在任何字段中生成重复的短语、无意义的词语循环（如重复的“OK”、“结束”、“设备总价”等）。所有文本字段必须简明扼要，直接输出核心内容，不要添加任何解释性、确认性或礼貌性的废话。**`;

  let text = "{}";

  if (modelType === 'qwen') {
    try {
      let qwenUrl = import.meta.env.VITE_QWEN_URL;
      let qwenApiKey = import.meta.env.VITE_QWEN_API_KEY;
      const qwenModel = import.meta.env.VITE_QWEN_MODEL || "qwen-vl-plus";

      if (qwenUrl) qwenUrl = qwenUrl.replace(/^["']|["']$/g, '');
      if (qwenApiKey) qwenApiKey = qwenApiKey.replace(/^["']|["']$/g, '');

      if (!qwenUrl || !qwenApiKey) {
        throw new Error("Qwen API配置缺失，请检查环境变量。");
      }

      // Determine if the URL is Anthropic compatible or OpenAI compatible based on the URL path
      const isAnthropic = qwenUrl.includes('anthropic');

      const response = await fetch('/api/qwen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(isAnthropic ? {
          model: qwenModel,
          temperature: 0.2,
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
          max_tokens: 8192
        } : {
          model: qwenModel,
          temperature: 0.2,
          presence_penalty: 0.5,
          frequency_penalty: 0.5,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ]
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Qwen API Error: ${response.status} ${errText}. Falling back to Gemini.`);
        throw new Error(`Qwen API Error: ${response.status}`);
      }

      const data = await response.json();
      if (isAnthropic) {
        text = data.content?.[0]?.text || "{}";
      } else {
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
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("未找到 Gemini API Key，请配置环境变量或设置私有 Key。");
      }
      const ai = new GoogleGenAI({ apiKey });
      const modelName = modelType === 'gemini-pro' ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("API请求超时，请重试")), 300000); // 5 minutes
      });

      let response;
      let retries = 3;
      let backoff = 2000;
      
      while (retries >= 0) {
        try {
          const generatePromise = ai.models.generateContent({
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
              temperature: 0.2,
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
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
                      comprehensiveSolution: { type: Type.STRING },
                      keyMetrics: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            label: { type: Type.STRING },
                            value: { type: Type.STRING },
                            trend: { type: Type.STRING },
                            trendValue: { type: Type.STRING }
                          },
                          required: ["label", "value"]
                        }
                      },
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
                      },
                      donutData: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            value: { type: Type.NUMBER }
                          },
                          required: ["name", "value"]
                        }
                      },
                      donutDescription: { type: Type.STRING },
                      barData: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            value: { type: Type.NUMBER }
                          },
                          required: ["name", "value"]
                        }
                      },
                      barDescription: { type: Type.STRING }
                    },
                    required: ["networkingPlan", "packageRecommendation", "comprehensiveSolution", "keyMetrics", "radarData", "donutData", "barData"]
                  },
                  widthMeters: { type: Type.NUMBER },
                  lengthMeters: { type: Type.NUMBER },
                  areaSquareMeters: { type: Type.NUMBER }
                },
                required: ["recommendedCount", "equipment", "routers", "explanation", "solution", "widthMeters", "lengthMeters", "areaSquareMeters"]
              }
            }
          });

          response = await Promise.race([generatePromise, timeoutPromise]) as any;
          break; // Success, exit retry loop
        } catch (e: any) {
          let errorMessage = e.message || String(e);
          if (typeof e === 'object' && e !== null && !errorMessage.includes("503")) {
            try {
              errorMessage += " " + JSON.stringify(e);
            } catch (err) {}
          }
          const isRetryable = errorMessage.includes("503") || 
                              errorMessage.includes("500") ||
                              errorMessage.includes("Internal Server Error") ||
                              errorMessage.includes("high demand") || 
                              errorMessage.includes("UNAVAILABLE") ||
                              errorMessage.includes("timeout") ||
                              errorMessage.includes("超时") ||
                              errorMessage.includes("fetch failed") ||
                              errorMessage.includes("Failed to fetch");
                              
          if (isRetryable && retries > 0) {
            console.warn(`Gemini API Error (${errorMessage}). Retrying in ${backoff / 1000} seconds... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff *= 2; // Exponential backoff: 2s, 4s, 8s
            retries--;
            continue;
          }
          throw e; // Re-throw if not retryable or out of retries
        }
      }

      text = response.text || "{}";
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      let errorMessage = e.message || String(e);
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        errorMessage = "API 调用次数已达上限 (Quota Exceeded)。请稍后再试或检查您的 API Key 额度。";
      } else if (errorMessage.includes("503") || errorMessage.includes("500") || errorMessage.includes("Internal Server Error") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
        errorMessage = "当前 AI 模型访问量过大或服务异常 (500/503)。请稍等片刻后重试。";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("超时")) {
        errorMessage = "API 请求超时，请重试。";
      } else {
        errorMessage = `AI 模型调用失败。可能是网络连接问题或跨域限制。详细错误: ${errorMessage}`;
      }
      throw new Error(errorMessage);
    }
  }

  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Find the first '{' to extract JSON in case of extra text
  const startIndex = text.indexOf('{');
  if (startIndex !== -1) {
    const endIndex = text.lastIndexOf('}');
    const afterLastBrace = text.substring(endIndex + 1).trim();
    // Only use endIndex if it's at the end of the string (ignoring whitespace)
    // If there is text after the last '}', it might be truncated JSON, so we keep it.
    if (endIndex !== -1 && afterLastBrace === '') {
      text = text.substring(startIndex, endIndex + 1);
    } else {
      text = text.substring(startIndex);
    }
  }

  const fixJsonString = (str: string) => {
    let inString = false;
    let isEscaped = false;
    let stack: string[] = [];
    let result = '';
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (inString) {
        if (char === '"' && !isEscaped) {
          inString = false;
          result += char;
        } else if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else {
          isEscaped = (char === '\\' && !isEscaped);
          result += char;
        }
      } else {
        if (char === '"') {
          inString = true;
          isEscaped = false;
        } else if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}' || char === ']') {
          stack.pop();
        }
        result += char;
      }
    }
    
    if (inString) {
      if (isEscaped) {
        result = result.slice(0, -1);
      }
      result += '"';
    } else {
      result = result.replace(/[,:]\s*$/, '');
    }
    
    while (stack.length > 0) {
      const char = stack.pop();
      if (char === '{') result += '}';
      else if (char === '[') result += ']';
    }
    
    return result;
  };

  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error("JSON Parse Error. Raw text:", text);
    console.error(parseError);
    
    let fixedText = fixJsonString(text);
    
    try {
      return JSON.parse(fixedText);
    } catch (e1) {
      throw new Error(`AI 返回的数据格式有误，无法解析。请重试或修改提示词。详细错误: ${parseError}`);
    }
  }
}
