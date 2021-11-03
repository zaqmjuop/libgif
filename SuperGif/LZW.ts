const source = "ABRACADABRABRABRA ";
const REG_LETTER_NUMBER = /^[a-zA-Z0-9]$/
export const encodeLZW = (source: string) => {
  const result: number[] = [];
  const dictionary: { [key: string]: number } = {};
  let lastCode = 'z'.charCodeAt(0) + 1;
  let prevMatch = "";
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (!/^\S$/.test(char)) {
      result.push(char.charCodeAt(0));
      break;
    } else if (!dictionary.hasOwnProperty(char)) {
      const code = REG_LETTER_NUMBER.test(char) ? char.charCodeAt(0) : ++lastCode
      dictionary[char] = code;
      continue
    } else {
      let match = char;
      let feed = 1;
      // 最后向后一位会看到结束符
      for (; /^\S$/.test(source[index + feed]) && dictionary.hasOwnProperty(match + source[index + feed]); feed++) {
        match += source[index + feed];
      }
      result.push(dictionary[match]);
      if (prevMatch) {
        dictionary[prevMatch.concat(char)] = ++lastCode;
      }
      prevMatch = match;
      index += feed;
    }
  }
  return result;
};
const zip = encodeLZW(source);

export const deLZW = (codes: number[]) => {
  let res = "";
  const dictionary = {};
  let lastCode = 'z'.charCodeAt(0) + 1;
  let prevKey = "";
  for (let index = 0; index < codes.length; index++) {
    const code = codes[index];
    if (code === ' '.charCodeAt(0)) {
      res += ' '
      break
    } else {
      const key = code < 'z'.charCodeAt(0) ? String.fromCharCode(code) : dictionary[code];
      res += key;
      if (prevKey) {
        dictionary[++lastCode] = prevKey.concat(key[0])
      }
      prevKey = key;
    }
  }
  return res;
};
const unZip = deLZW(zip);
console.log(source, unZip);
console.log(source === unZip);
