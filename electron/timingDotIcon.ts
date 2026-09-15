import { nativeImage, type NativeImage } from 'electron';

// Red (#EF4444) dot with a white ring, for the 16px taskbar overlay at 1x and 2x scale.
const DOT_1X_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAo0lEQVR42q2T7wnDIBTEHcFRMkQGcCQ/Zwkhu2QeC6EE8qG/cuWltKkhbVU4kOfdvT+qc4UFeCAA0aC9d2fLhOk2z6zTxDKOD2ivmM4OjYAOyBJcQiD3/RsU05k44pYy5+swfAj3EMdM/KtBkvuZeINVkp7Z1V+p7COIazPxMgga0rfiDdJIK4P4S/m7NmITg+oW6oZYfY1NHlL1U27ymf79znc9+VM7CP7Y+QAAAABJRU5ErkJggg==';
const DOT_2X_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABHklEQVR42tVX0Q2DIBB1BIdyALZwABdwA//8NekirOAA7mBTk/ajTV9zhGsuSq1aCPSSlxiBew/uOCDL/skAKAANAI2ladumfJPmAGoAI7bbaMfkPmb8Jn4MA26nE6aqwlkpjEVhQN/0j9qoz0yIOkresZd73xsCJvwG6ktjhHWHyJ/ThGvbbiaeg8aSj10iJPmlLA+TM8jHZhE25t7IP4hQa9luEu6XZV8Lh0jM3CWg5oTzTc4QiVm7BJjZ78n2vSDfvArO2NMeDkXOEHVCSQFUQk0hCS2AOKw1UoAOvfyOMGgpwJgsr6FAHGwLAaHJGekKiBmC6EkYfRvGLUTRS3Eqh1Hc4zj6hSSJK1kSl9IkruVJPEySeJol8TgNbS/8gzsFAm6PlwAAAABJRU5ErkJggg==';

/** Builds the taskbar overlay shown while the timer is counting. */
export const createTimingDotIcon = (): NativeImage => {
  const icon = nativeImage.createEmpty();
  icon.addRepresentation({ scaleFactor: 1, dataURL: DOT_1X_DATA_URL });
  icon.addRepresentation({ scaleFactor: 2, dataURL: DOT_2X_DATA_URL });
  return icon;
};
