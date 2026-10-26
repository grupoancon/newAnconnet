declare module "html-to-docx" {
  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: Record<string, unknown>,
    footerHTMLString?: string | null
  ): Promise<Blob | Buffer>
}
