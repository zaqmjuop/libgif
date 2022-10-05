# @zaqmjuop/libgif 介绍和 [示例](https://zaqmjuop.github.io/libgif/)

这是[libgif-js](https://github.com/buzzfeed/libgif-js) 的一个分支，该项目被实现为一个用来在浏览器端对 GIF 进行解码和操纵动画的脚本组件。

如果你喜欢它，请给它一个 Star！

**添加了一些变化**

- 优化了播放控制逻辑，添加了控制播放速率、播放方向、循环播放的功能
- 优化了解码逻辑，解码耗时降低了一倍以上
- 增加了内存缓存池，现在对同一地址的图片不会再重复请求或重复解码
- 增加了自动适应元素宽高的能力

# 用法示例

安装

```
npm i @zaqmjuop/libgif
```

在页面里放置一个画布容器

```html
<canvas id="myGif" />
```

初始化控制器示例

```typescript
import libgif from '@zaqmjuop/libgif'

const controls = libgif({
  gif: document.getElementById('myGif'),
  src: 'https://img95.699pic.com/photo/40165/2060.gif_wh860.gif'
})
```

# API 说明

### 构造函数选项

- **gif**: HTMLCanvasElement[必要] 呈现动画的画布容器
- **src**: string[可选] 初始化后自动播放的图片地址
- **forword**: boolean[可选] 播放方向，默认值是 true，即正序播放
- **rate**: number[可选] 播放速率，默认值是 1，即 1 倍速率
- **loop**: boolean[可选]循环播放，默认值是 true，即循环播放

### 控制器属性

- **playing**: boolean[只读] 是否播放中
- **loopCount**: number[只读] 循环播放次数
- **currentKey**: string[只读] 当前播放的文件地址
- **currentFrameNo**: number[只读] 当前播放帧的次序
- **rate**: number 播放速率
- **forward**: boolean 播放方向
- **loop**: boolean 是否循环播放

### 控制器方法

- **play()**: void 播放动画
- **pause()**: void 暂停动画
- **jumpTo(No: number)**: void 跳转到指定次序，No 是指定帧的次序
- **loadUrl(key: string)**: void 加载新的 GIF 文件，key 是 GIF 文件地址
- **getDecodeData(key: string)**: DecodedData 获取 GIF 的解码信息，key 是已缓存的 GIF 文件地址
- **getDownload(key: string)**: DownloadRecord 获取 GIF 的文件内容，key 是已缓存的 GIF 文件地址
- **on(type: string, callback)**: void 监听事件
- **off(type: string, callback)**: void 卸载事件监听

### 控制器事件

- **play** 从暂停到播放时触发
- **frameChange** 播放次序改变时触发
- **pause** 从播放到暂停时触发
- **playended** 最后一帧播放完触发
- **decoded** 有 GIF 文件解码完成时触发
- **downloaded** 有 GIF 文件下载完成时触发
- **progress** 有 GIF 文件下载时触发

# 注意事项

GIF 文件必须和您正在加载的页面位于同一域上。
因为该库的工作原理是通过 Ajax 请求 GIF 图像数据，解码 GIF 文件并获取帧信息，并将它们呈现在 canvas 元素上。
