export class VideoRTC extends HTMLElement {
  mode: string;
  media: string;
  background: boolean;
  visibilityCheck: boolean;
  video: HTMLVideoElement;
  wsState: number;
  pcState: number;
  onmessage: Record<string, (msg: { type: string; value: string }) => void>;
  set src(value: string | URL);
  oninit(): void;
  onconnect(): boolean;
  ondisconnect(): void;
  onopen(): string[];
  onclose(): boolean;
  onpcvideo(video: HTMLVideoElement): void;
}
