const text = `{"recommendedCount":7,"equipment":"1主6从 (联通FTTO全光企业级组网方案)","routers":[{"x":85,"y":75,"type":"ftto-main","locationDescription":"弱电间/储藏室入口，作为全网核心控制节点"},{"x":15,"y":30,"type":"ftto-sub","locationDescription":"左侧开放办公区北部，覆盖高密度工位区"},{"x":15,"y":70,"type":"ftto-sub","locationDescription":"左侧开放办公区南部，确保大空间信号均匀"},{"x":45,"y":60,"type":"ftto-sub","locationDescription":"中部办公室走廊，覆盖办公室9-11及周边区域"},{"x":65,"y":35,"type":"ftto-sub","locationDescription":"大会议室中心，满足高密度视频会议接入"},{"x":55,"y":85,"type":"ftto-sub","locationDescription":"培训室顶部，支持大规模移动终端并发"},{"x":90,"y":20,"type":"ftto-sub","locationDescription":"右侧办公室集群中心，覆盖办公室1-8区域"}],"explanation":{"priority":"核心办公区高并发接入，会议室及培训室高密度覆盖，全场无缝漫游设计。","strategy":"采用联通FTTO全光组网，主网关置于弱电间，通过光纤直达`;

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
  const fixed = fixJsonString(text);
  console.log("Fixed text:", fixed);
  JSON.parse(fixed);
  console.log("Parse SUCCESS");
} catch (e: any) {
  console.log("Parse FAILED:", e.message);
}
