export type offset = { x: number; y: number };
export type header = {
  hdr?: (block: any) => void;
  gce?: (block: any) => void;
  com?: (block: any) => void;
  app?: {
    NETSCAPE: (block: any) => void;
  };
  img?: (block: any) => void;
  eof?: (block: any) => void;
  pte?: (block: any) => void;
  unknown?: (block: any) => void;
};
export type opts = {
  vp_l?: number;
  vp_t?: number;
  vp_w?: number;
  vp_h?: number;
  //canvas sizes
  c_w?: number;
  c_h?: number;
  is_vp?: boolean;
  gif: HTMLImageElement;
  auto_play?: boolean;
  on_end?: Function;
  loop_delay?: number;
  loop?: boolean;
  draw_while_loading?: boolean;
  show_progress_bar?: boolean;
  progressbar_height?: number;
  progressbar_background_color?: string;
  progressbar_foreground_color?: string;
  max_width?: number;
};
export type RGB = [number, number, number];
