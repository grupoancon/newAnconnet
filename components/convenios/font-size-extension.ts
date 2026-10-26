import { Extension } from "@tiptap/core"

// Tiptap v2 no trae una extensión de tamaño de fuente propia (recién existe para v3,
// todavía en pre-release, incompatible con la v2 que usa este editor) — esta es una
// extensión chica hecha a mano, con la misma forma que @tiptap/extension-font-family
// (agrega un atributo al mark "textStyle" ya existente, en vez de inventar un mark
// nuevo). Los tamaños se manejan en pt para que coincidan con lo que espera Word al
// exportar (ver aplicarFuenteBaseParaWord en lib/limpiar-html-word.ts, que solo pone un
// tamaño por defecto cuando el párrafo no tiene ya uno propio — un tamaño elegido acá
// nunca se pisa).

export type FontSizeOptions = {
  types: string[]
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})
