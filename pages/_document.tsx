import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
  DocumentInitialProps,
} from "next/document";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type MyDocumentProps = DocumentInitialProps & { locale: Locale };

export default class MyDocument extends Document {
  static async getInitialProps(
    ctx: DocumentContext
  ): Promise<MyDocumentProps> {
    const initialProps = await Document.getInitialProps(ctx);
    const locale = (ctx.locale ?? DEFAULT_LOCALE) as Locale;
    return {
      ...initialProps,
      locale,
    };
  }

  render() {
    const { locale = DEFAULT_LOCALE } = this.props as MyDocumentProps;
    const dir = locale === "ar" ? "rtl" : "ltr";
    return (
      <Html lang={locale} dir={dir}>
        <Head>
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
