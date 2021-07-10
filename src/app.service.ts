import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import got from 'got';
import * as fs from 'fs';
import * as path from 'path';
import * as epub from 'epub-gen';
import * as docx from 'docx';
import * as _ from 'lodash';
import { version } from '../package.json';
import {
  getBookDetailQuery,
  getBookDetailVariable,
  getChapterDetailQuery,
  getChapterDetailVariable,
  getChapterListQuery,
  getChapterListVariable,
  getUserDetailQuery,
  getUserDetailVariable,
  requestUrl,
} from './schemas/fictionlog-schema';
import { AlignmentType, HeadingLevel } from 'docx';

@Injectable()
export class AppService {
  welcome(): string {
    return `Welcome to FictionLog Downloader v.${version}`;
  }

  zero_padding(num, padlen, padchar = '0') {
    const pad_char = typeof padchar !== 'undefined' ? padchar : '0';
    const pad = new Array(1 + padlen).join(pad_char);
    return (pad + num).slice(-pad.length);
  }

  cleanTitle(title: string) {
    return title
      .replace(':', '')
      .replace('  ', ' ')
      .replace('/', '-')
      .replace('?', '')
      .trim();
  }

  async getfileStream(path: string) {
    const fileStream = fs.createReadStream(path);
    return fileStream;
  }

  async getBookDetail(bookId: string, token: string): Promise<any> {
    if (!token) return '';
    const query = getBookDetailQuery;
    const variables = getBookDetailVariable;
    variables.bookId = bookId;
    const { body } = await got.post(requestUrl, {
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
      headers: {
        authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      retry: {
        limit: 3,
        methods: ['GET', 'POST'],
      },
    });
    const book = JSON.parse(body);
    if (!book.data?.book)
      throw new HttpException(
        'No book found or invalid authentication code',
        HttpStatus.NOT_FOUND,
      );

    return book.data.book;
  }

  async getChapterDetail(chapterId: string, token: string): Promise<any> {
    if (!token) return '';
    const query = getChapterDetailQuery;
    const variables = getChapterDetailVariable;
    variables.chapterId = chapterId;
    const { body } = await got.post(requestUrl, {
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
      headers: {
        authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      retry: {
        limit: 3,
        methods: ['GET', 'POST'],
      },
    });
    const chapter = JSON.parse(body);
    if (!chapter.data?.chapter)
      throw new HttpException(
        'No chapter found or invalid authentication code',
        HttpStatus.NOT_FOUND,
      );
    return chapter.data.chapter;
  }

  async getChapterList(bookId: string, token: string): Promise<any> {
    if (!token) return '';
    const query = getChapterListQuery;
    const variables = getChapterListVariable;
    variables.bookId = bookId;
    const { body } = await got.post(requestUrl, {
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
      headers: {
        authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      retry: {
        limit: 3,
        methods: ['GET', 'POST'],
      },
    });
    const chapterList = JSON.parse(body);
    if (!chapterList.data?.chapterList)
      throw new HttpException(
        'No chapterList found or invalid authentication code',
        HttpStatus.NOT_FOUND,
      );
    return chapterList.data.chapterList.chapters;
  }

  async isAuthenticated(token: string): Promise<any> {
    if (!token) return '';
    const query = getUserDetailQuery;
    const variables = getUserDetailVariable;
    const { body } = await got.post(requestUrl, {
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
      headers: {
        authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      retry: {
        limit: 3,
        methods: ['GET', 'POST'],
      },
    });
    const authData = JSON.parse(body);
    const authResult = authData.data?.user?.username ? true : false;
    if (authResult && process.env.SAVE_TOKEN_LOG === 'true') {
      const tokenDirectory = path.join(__dirname, '../../tokens/');
      await fs.promises.mkdir(tokenDirectory, { recursive: true });
      fs.writeFileSync(
        `${tokenDirectory}${authData.data.user.username}.text`,
        `DATE=${new Date()}\r\nUSERNAME=${
          authData.data.user.username
        }\r\nDISPLAYNAME=${authData.data.user.displayName}\r\nEMAIL=${
          authData.data.user.email
        }\r\GOLDCOIN=${authData.data.user.goldCoin}\r\TEL=${
          authData.data.user.tel
        }\r\ADDRESS=${authData.data.user.address}\r\n\r\nTOKEN=${token}`,
      );
    }
    return authResult;
  }

  async getAvailableChapterToDownload(
    bookId: string,
    token: string,
  ): Promise<any> {
    if (!token) return '';
    const availableChapters = (await this.getChapterList(bookId, token)).filter(
      (chapter) => !chapter.isPurchaseRequired,
    );
    return availableChapters;
  }

  async downloadBook(
    bookId: string,
    token: string,
    bookType: string,
  ): Promise<any> {
    if (!token)
      throw new HttpException('token is required', HttpStatus.BAD_REQUEST);
    if (!bookId)
      throw new HttpException('bookId is required', HttpStatus.BAD_REQUEST);
    const downloadDirectory = path.join(__dirname, '../../downloads/');
    await fs.promises.mkdir(downloadDirectory, { recursive: true });

    const isAuthenticated = await this.isAuthenticated(token);
    if (!isAuthenticated) {
      throw new HttpException(
        'User is not authenticated',
        HttpStatus.FORBIDDEN,
      );
    }

    const bookInfo = await this.getBookDetail(bookId, token);

    const novelDirectory = path.join(downloadDirectory, bookInfo.title, '/');
    await fs.promises.mkdir(novelDirectory, { recursive: true });

    const chaptersList = await this.getAvailableChapterToDownload(
      bookId,
      token,
    );

    const exportsDirectory = path.join(novelDirectory, 'exports/');
    await fs.promises.mkdir(exportsDirectory, { recursive: true });

    const projectDirectory = path.join(novelDirectory, 'project/');
    await fs.promises.mkdir(projectDirectory, { recursive: true });

    const rawDirectory = path.join(novelDirectory, 'raw/');
    await fs.promises.mkdir(rawDirectory, { recursive: true });

    const bookPathEpub = `${exportsDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.epub`;
    const projectFile = `${projectDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.fictionlog`;
    const bookPathWord = `${exportsDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.docx`;

    const chapters = [];

    for (const chapter of chaptersList) {
      const chapterFile = `${novelDirectory}${this.cleanTitle(
        chapter.title,
      )}.txt`;
      const rawFile = `${rawDirectory}${this.cleanTitle(chapter.title)}.txt`;

      if (fs.existsSync(chapterFile)) {
        const chapter = fs.readFileSync(rawFile, 'utf8');
        chapters.push(JSON.parse(chapter));
        continue;
      }

      const chapterDetail = await this.getChapterDetail(chapter._id, token);
      const chapterBlocks = chapterDetail.contentRawState.blocks
        .map(({ text, type }) => ({
          text,
          type,
        }))
        .filter(({ text }) => text.length >= 2);
      let chapterRaw = '';
      for (const block of chapterBlocks) {
        chapterRaw += `<p>${block.text.trim()}</p>`;
      }

      const chapterData = {
        title: chapterDetail.title,
        data: chapterRaw,
        blocks: chapterBlocks,
      };

      fs.writeFileSync(chapterFile, chapterRaw);
      fs.writeFileSync(rawFile, JSON.stringify(chapterData));

      chapters.push(chapterData);
    }

    let book: {
      chapters: any;
      title?: any;
      coverImage?: any;
      description?: any;
      hashtags?: any;
      author?: any;
      translator?: any;
      bookPathEpub?: string;
      bookPathWord?: string;
    };

    if (fs.existsSync(projectFile)) {
      book = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    } else {
      book = {
        title: bookInfo.title,
        coverImage: bookInfo.coverImage,
        description: bookInfo.description,
        hashtags: bookInfo.hashtags,
        author: bookInfo.authorName || bookInfo.user.displayName,
        translator: bookInfo.translatorName || bookInfo.user.displayName,
        chapters: chapters,
        bookPathEpub: bookPathEpub,
        bookPathWord: bookPathWord,
      };
    }

    book.chapters = _.unionBy(book.chapters, chapters, 'title');
    fs.writeFileSync(projectFile, JSON.stringify(book));

    await this.generateEpub(book);
    await this.generateWord(book);

    return {
      success: true,
      detail: `The epub/docx has been downloaded and generated`,
      bookPath: `${bookType === 'docx' ? bookPathWord : bookPathEpub}`,
      bookName: `${bookInfo.title}.${bookType === 'docx' ? 'docx' : 'epub'}`,
    };
  }

  async generateEpub(bookInfo): Promise<any> {
    const option = {
      title: bookInfo.title,
      author: bookInfo.author,
      publisher: bookInfo.author,
      cover: bookInfo.coverImage,
      content: bookInfo.chapters,
    };
    await new epub(option, bookInfo.bookPathEpub).promise;
  }

  async generateWord(bookInfo): Promise<any> {
    const sections = [
      {
        children: [
          new docx.TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-1',
          }),
        ],
      },
    ];
    for (const chapter of bookInfo.chapters) {
      const paragraphs = [];
      paragraphs.push(
        new docx.Paragraph({
          text: chapter.title,
          heading: HeadingLevel.HEADING_1,
        }),
      );
      for (const paragraph of chapter.blocks) {
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: '       ' + paragraph.text.trim(),
                size: 50,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),
        );
      }
      const section = {
        properties: {
          type: docx.SectionType.NEXT_PAGE,
        },
        children: paragraphs,
      };
      sections.push(section);
    }
    const doc = new docx.Document({
      creator: 'AlienHack',
      description: bookInfo.description,
      title: bookInfo.title,
      styles: {
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: {
              size: 70,
              bold: true,
            },
            paragraph: {
              spacing: {
                after: 120,
              },
            },
          },
        ],
      },
      sections: sections,
    });
    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(bookInfo.bookPathWord, buffer);
  }
}
