import { requireOptionalNativeModule } from "expo";
import { parseShareInbox } from "./share-policy";

type NativeInbox = {
  listAsync(): Promise<string>;
  removeAsync(id: string): Promise<void>;
  clearAsync(): Promise<void>;
};
const native = requireOptionalNativeModule<NativeInbox>("LearningShare");
export const shareInbox = {
  available: !!native,
  list: async () => (native ? parseShareInbox(await native.listAsync()) : []),
  remove: async (id: string) => {
    await native?.removeAsync(id);
  },
  clear: async () => {
    await native?.clearAsync();
  },
};
