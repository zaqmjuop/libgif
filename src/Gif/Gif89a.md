# 类型和字段说明

type 1b = 0|1
type 2b = /[0|1]{2}/
type 3b = /[0|1]{3}/
type 1B = 8b

## 字段名

```yml
header: Header # 文件头
gctFlag: GlobalColorFlag # 若是1，则Header后面跟全局颜色表
cr: ColorResolution # 色深是 cr+1，若cr+1===8，说明图片色深是8bit
s: SortFlag # 若是1，表示全局颜色表分类排列
gctSize: GlobalColorTableSize # 全局颜色表的长度是2的(gctSize+1)次方
```

# 编码字段

## Header

```ts
type b = '0'|'1'
type b2 = '00'|'01'|'10'|'11'
type b3 = '000'|'001'|'010'|'011'|'100'|'101'|'110'|'111'
type B = `${b}${b}${b}${b}${b}${b}${b}${b}`
type B2 = `${B}${B}`
type B3 = `${B}${B}${B}`
type Header = [
  sig: B3 // "GIF" Signature 文件类型
  ver: B3, // "89a"|"87a" Version 编码版本
  width: B2 // number 图片宽度
  height: B2 // number 图片高度
  [
    gctFlag: b // GlobalColorFlag 若是1，则Header后面跟全局颜色表
    cr: b3 // ColorResolution 色深是 cr+1，若cr+1===8，说明图片色深是8bit
    s: b, // SortFlag 若是1，表示全局颜色表分类排列
    gctSize:b3 // GlobalColorTableSize 全局颜色表的长度是2的(gctSize+1)次方
  ]
]
header: Header // 文件头
  sig: "GIF" // Signature 3B 文件类型
  ver: "89a"|"87a" // Version 3B 编码版本
  width: number // 2B 图片宽度
  height: number // 2B 图片高度
  [
    gctFlag: GlobalColorFlag 1b, // 若是1，则Header后面跟全局颜色表
    cr: ColorResolution 3b, // 色深是 cr+1，若cr+1===8，说明图片色深是8bit
    s: SortFlag 1b, // 若是1，表示全局颜色表分类排列
    gctSize: GlobalColorTableSize 3b // 全局颜色表的长度是2的(gctSize+1)次方
  ]
  bgIndex: BackgroundColorIndex 1B number // if(gctFlag){ 背景色 = gct[bgIndex] }
  pixelAspectRatio: 1B // 像素宽高比
```
