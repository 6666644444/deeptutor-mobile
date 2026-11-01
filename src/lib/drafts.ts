import type { TutorClient } from "./client";
export type Photo = { uri: string; base64: string; filename: string };
export type QuestionDraft = {
  question: string;
  explanation: string;
  session_id?: string;
};
const photos = new WeakMap<TutorClient, Photo>();
const questions = new WeakMap<TutorClient, QuestionDraft>();
export const photoDraft = {
  peek: (api: TutorClient) => photos.get(api),
  set: (api: TutorClient, value: Photo) => { api.assertOpen(); photos.set(api, value); api.onClose(() => photos.delete(api)); },
  take: (api: TutorClient) => {
    const value = photos.get(api);
    photos.delete(api);
    return value;
  },
};
export const questionDraft = {
  set: (api: TutorClient, value: QuestionDraft) => { api.assertOpen(); questions.set(api, value); api.onClose(() => questions.delete(api)); },
  take: (api: TutorClient) => {
    const value = questions.get(api);
    questions.delete(api);
    return value;
  },
};
