> 约定
两个字节以上数的存放顺序为低字节在前
type bit = '0'|'1';
type Byte = /^[01]{8}$/
type unsigned = '字节或像素';
type color = Byte; // 0~255
type RGB = /^color{3}$/;
type ColorTable = RGB[];

{
B: Byte,
b: bit,
top: unsigned,
left: unsigned,
width: unsigned,
height: unsigned,
carry-bit: '小->大',
\*: 名词解释,
#: 效果演示,
}

1. Header

type Signature = 'GIF';
type Version = "89a"|"87a";
const Header = Signature + Version;

2. Logical Screen Descriptor

type logical_screen_width = Byte + Byte # 单位是像素
type logical_screen_height = Byte + Byte # 单位是像素
type global_color_table_flag = bit; # 是 1 时代表是 Logical Screen Descriptor后面是全局颜色表
type color_resolution = bit+bit+bit

const LogicalScreenDescriptor = logical_screen_width + logical_screen_height

[
  logical_screen_width: 2B像素 : ,
  logical_screen_height: 2B像素 : ,
  packet_fields: 1B : `global_color_table_flag, color_resolution, sort_flag, global_color_table_size`
  background_color_index: 1B : ,
  pixel_aspect_ratio: 1B : ,
]
- global_color_table_flag：/^[01]$/ 是 1 时代表是 Logical Screen Descriptor后面是全局颜色表
- color_resolution：/^[01]{3}$/ 表示颜色表中每种基色用多少位表示，比如 '111' 表示8位表示一种基色,则颜色表每项是 color_resolution*3位,一般不处理
- sort_flag：/^[01]$/ 是1时表示重要颜色排在前，一般为0。若为1，可以用来实现色块loading
- global_color_table_size: /^[01]{3}$/ 表示颜色表数组长度0~256 gct_length = 1 << global_color_table_size; 颜色表每项3B
- background_color_index：背景色在颜色表中的索引值，用于填充图片背景色
- pixel_aspect_ratio: 像素宽高比，一般是0，不做处理，直接用 logical_screen_width 和 logical_screen_depth 算图片大小

3. global_color_table 结构
type GlobalColorTable = ColorTable[]

4. image_descriptor 结构
[
  image_separator: 0x2C, // ","
  leftPos: 2B, // 后面跟的图像 rect
  topPos:2B,
  width:2B,
  height: 2B,
  packet_fields: `${local_color_table_flag:1b}${interlace_flag:1b}${sort_flag:1b}${reserved:2b}${local_color_table_size:3b}`
]
image_separator: 0x2C, // ","
local_color_table_flag: 1b;// 确定这帧的颜色表 const ct = local_color_table_flag ? lct : (gct || system_color_table);
interlace_flag: 1b; // 是否错行，用来实现模糊变清晰的效果

5. local_color_table 结构
type local_color_table = ColorTable[]

6. table_based_image_data 结构
type block_size = 1B;
type block_data = NB;
type block = [block_size, ...block_data[]];
[
  LZW_code_size: 1B,
  ...block[],
  block_terminator: 0x00, // 表示该帧结束
]
LZW_code_size: 表示一个像素索引值最少比特位数，如 0x08 时表示解码后每个像素索引值时8位
block: unsigned char ;//图像数据块 长度最大255B
图像域：[image_descriptor, lct?, table_based_image_data, extension_block? ]
type extension_block = application_extension|comment_extension|graphic_control_extension
7. application_extension 结构
type extension_block = [
  extension_introducer: 0x21, // '!' 扩展导入符
  application_label: 0xff, // 扩展块标签
  block_size: 1B, // application_data 大小
  application_infomation: 11B, // 前8节时制作gif的应用名称，后3节时应用识别码
  application_data: NB,
  block_terminator: 0x00, // 表示该块结束
]
8. comment_extension 结构
type comment_extension = [
  extension_introducer: 0x21, // '!' 扩展导入符
  label: 0xfe, // 
  block_size: 1B,
  comment_data: NB, //
  block_terminator: 0x00, // 表示该块结束
]
1. graphic_control_extension 结构
[
   extension_introducer: 0x21, // '!' 扩展导入符
   graphic_control_label: 0xf9, // 固定开始符号
   block_size: 1B, // 0x04
   packet_fields: [
     reserved: 3b,
     display_method: 3b, // 一般是 1 不做处理，其他值见89a【1】
     user_input_flag: 1b, // 为 1 时表示处理完该帧后等待输入后再处理下一帧
     transparent_color_flag: 1b
   ],
   delay: 2B, // 单位时 10 毫秒
   transparent_color_index: 1B,
   block_terminator: 1B,
]
if(!user_input_flag && !delay){
  直接下一帧
}else if(user_input_flag && !delay){
  暂停直到输入
}else if(!user_input_flag && delay){
  等到 delay 下一帧
}else if(user_input_flag && delay){
  等到输入或delay 下一帧
}
transparent_color_flag 透明色索引标志，表示透明色索引是否有效
transparent_color_index 透明色索引 !!transparent_color_flag 时解码所得索引与该索引相等时，不更新对应像素

10. plain_text_extension 结构
[
    extension_introducer: 0x21, // '!' 扩展导入符
    plain_text_label: 0x01, //
    block_size: 1B, // NB 大小
    plain_text_control_info: 12B, // 文本网格，字符及其颜色的信息
    plain_text_data: NB, // 要显示的plain text信息
    block_terminator: 0x00, // 表示该块结束
]
> extension_block 中只有 graphic_control_extension 影响显示，其他都是图像注释
11. trailer 结构 gif 文件结束符
type trailer = 0x3B; // ';'
12. LZW 压缩算法