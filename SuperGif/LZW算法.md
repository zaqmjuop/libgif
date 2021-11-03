### 压缩
```flow
st=>start: 开始
init=>operation: 初始化字典表和压缩数组
readChar=>operation: string
isEnd=>condition: 是否是结束符
isMatchChar=>condition: 是否从字典表匹配字符
addDictionaryChar=>operation: 设置该字符到字典
matchLongestStr=>operation: 不断尝试读取下一字符直到从

io=>inputoutput: 返回压缩结果
end=>end: 结束





finally=>operation: 结果添加结束符
isMatch=>condition: 是否从字典表匹配
addChar=>operation: 字典表设置该字符并赋值

st->init->readCode(left)->isEnd
                    isEnd(yes, left)->finally->io
                    isEnd(no)->isMatch
                               isMatch(no, top)->addChar(top)->isEnd



```
判断字符类型
结束符
结果添加结束code
是否从字典表匹配
未匹配：设置字典表该字符的code
匹配：从字典表匹配最长的字符串
结果添加该匹配的code值

