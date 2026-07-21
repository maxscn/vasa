import type { AnyExtension, SkrivaExtension } from "@skriva/core";

export const skrivaMetadataKey = Symbol.for("@openinspection/skriva.extensionMetadata");

export type SkrivaAwareTiptapExtension<T extends AnyExtension = AnyExtension> = T & {
  readonly skriva: readonly SkrivaExtension[];
  readonly [skrivaMetadataKey]: readonly SkrivaExtension[];
};

export type SkrivaExtensionInput = SkrivaExtension | SkrivaAwareTiptapExtension;

export function createSkrivaTiptapExtension<T extends AnyExtension>(
  extension: T,
  options: { skriva: readonly SkrivaExtension[] },
): SkrivaAwareTiptapExtension<T> {
  attachSkrivaMetadata(extension, options.skriva);
  preserveSkrivaMetadata(extension, "configure", options.skriva);
  preserveSkrivaMetadata(extension, "extend", options.skriva);

  return extension as SkrivaAwareTiptapExtension<T>;
}

export function collectSkrivaExtensions(
  extensions: readonly SkrivaExtensionInput[] | undefined,
): SkrivaExtension[] {
  return (extensions ?? []).flatMap((extension) => {
    if (isSkrivaAwareTiptapExtension(extension)) return [...extension.skriva];
    return [extension as SkrivaExtension];
  });
}

export function collectSkrivaExtensionsFromTiptap(
  extensions: readonly AnyExtension[] | undefined,
): SkrivaExtension[] {
  return (extensions ?? []).flatMap((extension) =>
    isSkrivaAwareTiptapExtension(extension) ? [...extension.skriva] : [],
  );
}

export function isSkrivaAwareTiptapExtension(
  extension: unknown,
): extension is SkrivaAwareTiptapExtension {
  return typeof extension === "object" && extension !== null && skrivaMetadataKey in extension;
}

function attachSkrivaMetadata(extension: AnyExtension, skriva: readonly SkrivaExtension[]) {
  Object.defineProperties(extension, {
    skriva: {
      configurable: true,
      enumerable: false,
      value: skriva,
    },
    [skrivaMetadataKey]: {
      configurable: true,
      enumerable: false,
      value: skriva,
    },
  });
}

function preserveSkrivaMetadata(
  extension: AnyExtension,
  methodName: "configure" | "extend",
  skriva: readonly SkrivaExtension[],
) {
  const method = extension[methodName];
  if (typeof method !== "function") return;

  Object.defineProperty(extension, methodName, {
    configurable: true,
    enumerable: false,
    value: (...args: unknown[]) =>
      createSkrivaTiptapExtension((method as (...args: unknown[]) => AnyExtension)(...args), {
        skriva,
      }),
  });
}
