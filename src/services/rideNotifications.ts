import { Capacitor } from '@capacitor/core';
import notificationSoundUrl from '../notificacao/som_corrida.wav';

let notificationAudio: HTMLAudioElement | null = null;
let unlocking: Promise<void> | null = null;
let playbackGeneration = 0;

function getAudio(): HTMLAudioElement {
  if (!notificationAudio) {
    notificationAudio = new Audio(notificationSoundUrl);
    notificationAudio.preload = 'auto';
    notificationAudio.volume = 0.75;
  }
  return notificationAudio;
}

export async function prepareRideNotificationAudio(): Promise<void> {
  const audio = getAudio();
  audio.load();
  try {
    audio.muted = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  } catch (error) {
    console.warn(
      Capacitor.isNativePlatform()
        ? 'Não foi possível preparar o áudio de notificação no dispositivo.'
        : 'O navegador bloqueou a preparação do áudio; será tentada a reprodução após nova interação.',
      error
    );
  } finally {
    audio.muted = false;
  }
}

export async function playRideNotificationSound(): Promise<void> {
  const audio = getAudio();
  const generation = playbackGeneration;
  if (unlocking) await unlocking;
  if (generation !== playbackGeneration) return;
  audio.pause();
  audio.currentTime = 0;
  try {
    await audio.play();
    if (generation !== playbackGeneration) audio.pause();
  } catch (error) {
    console.warn(
      Capacitor.isNativePlatform()
        ? 'Não foi possível reproduzir o áudio de nova corrida.'
        : 'O navegador bloqueou o áudio de nova corrida. Interaja com o app para habilitá-lo.',
      error
    );
  }
}

export function stopRideNotificationSound(): void {
  playbackGeneration++;
  if (!notificationAudio) return;
  notificationAudio.pause();
  notificationAudio.currentTime = 0;
}

export function unlockRideNotificationAudio(): void {
  if (!unlocking) {
    unlocking = prepareRideNotificationAudio().finally(() => {
      unlocking = null;
    });
  }
  void unlocking;
}
