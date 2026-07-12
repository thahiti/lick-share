import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createLocationHashStore } from './adapters/location-hash-store';
import { createPlayer } from './adapters/player';
import { createRafClock } from './adapters/raf-clock';
import { createWebAudioSink } from './adapters/web-audio-sink';
import { App } from './ui/components/App';
import './styles/tokens.css';
import './styles/global.css';

const audioCtx = new AudioContext();
/* 모바일 정책: suspended 상태는 사용자 제스처에서 해제 */
document.addEventListener('pointerdown', () => {
  if (audioCtx.state === 'suspended') void audioCtx.resume();
});

const player = createPlayer({
  sink: createWebAudioSink(audioCtx),
  clock: createRafClock(),
});
const hashStore = createLocationHashStore();

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다');
createRoot(root).render(
  <StrictMode>
    <App player={player} hashStore={hashStore} />
  </StrictMode>,
);
