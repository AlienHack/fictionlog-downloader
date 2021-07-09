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
import { AlignmentType, HeadingLevel, UnderlineType } from 'docx';

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
    return JSON.parse(body).data?.user?.username ? true : false;
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

  async downloadBook(bookId: string, token: string): Promise<any> {
    if (!token) throw new Error('token is required');
    if (!bookId) throw new Error('bookId is required');
    const downloadDirectory = path.join(__dirname, '../../downloads/');
    await fs.promises.mkdir(downloadDirectory, { recursive: true });

    const isAuthenticated = await this.isAuthenticated(token);
    if (!isAuthenticated) {
      throw new HttpException(
        'User is not authenticated',
        HttpStatus.FORBIDDEN,
      );
    }

    // bookInfo._id
    // bookInfo.coverImage
    // bookInfo.description
    // bookInfo.user.displayName
    // bookInfo.title
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

    const bookPathEpub =
      exportsDirectory +
      bookInfo.title.replace(':', '').replace('  ', ' ').replace('/', '-') +
      '.epub';

    const projectFile =
      projectDirectory +
      bookInfo.title.replace(':', '').replace('  ', ' ').replace('/', '-') +
      '.fictionlog';

    const bookPathWord =
      exportsDirectory +
      bookInfo.title.replace(':', '').replace('  ', ' ').replace('/', '-') +
      '.docx';

    const chapters = [];
    // chapter._id
    // chapter.title
    for (const chapter of chaptersList) {
      const chapterFile =
        novelDirectory +
        chapter.title.replace(':', '').replace('  ', ' ').replace('/', '-') +
        '.txt';

      if (fs.existsSync(chapterFile)) {
        // const chapterRaw = fs.readFileSync(chapterFile, 'utf8');
        // chapters.push({
        //   title: chapter.title.replace('  ', ' '),
        //   data: chapterRaw,
        // });
        continue;
      }

      // chapterDetail._id
      // chapterDetail.title
      // chapterDetail.contentRawState.blocks[text, type]
      const chapterDetail = await this.getChapterDetail(chapter._id, token);
      const chapterBlocks = chapterDetail.contentRawState.blocks
        .map(({ text, type }) => ({
          text,
          type,
        }))
        .filter(({ text }) => text.length >= 2);
      let chapterRaw = '';
      for (const block of chapterBlocks) {
        chapterRaw += `<p>${block.text}</p>`;
      }

      fs.writeFile(chapterFile, chapterRaw, function (err) {
        if (err) console.log(err);
      });

      chapters.push({
        title: chapterDetail.title,
        data: chapterRaw,
        blocks: chapterBlocks,
      });
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
    fs.writeFile(projectFile, JSON.stringify(book), function (err) {
      if (err) console.log(err);
    });

    await this.generateEpub(book);
    await this.generateWord(book);
    return {
      success: true,
      detail: `The epub/docx has been downloaded and generated`,
      epub: bookPathEpub,
      docx: bookPathWord,
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
    new epub(option, bookInfo.bookPathEpub);
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
                text: '         ' + paragraph.text,
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
    docx.Packer.toBuffer(doc).then((buffer) => {
      fs.writeFileSync(bookInfo.bookPathWord, buffer);
    });
  }
}
