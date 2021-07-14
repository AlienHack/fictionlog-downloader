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
  purchaseChapter,
  purchaseChaptersVariable,
  requestUrl,
} from './schemas/fictionlog-schema';
import { AlignmentType, HeadingLevel } from 'docx';
import { Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger: Logger = new Logger('fiction-log-service');
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
      .replace(/\:/g, '-')
      .replace(/  /g, ' ')
      .replace(/\//g, '-')
      .replace(/\\/g, '-')
      .replace(/\?/g, '')
      .replace(/[^\u0E00-\u0E7Fa-zA-Z 0-9()\[\]\!\+\-]/g, '')
      .trim();
  }

  getDirectories(srcPath) {
    return fs
      .readdirSync(srcPath)
      .map((file) => path.join(srcPath, file))
      .filter((path) => fs.statSync(path).isDirectory());
  }

  getMissingChapters(allChapters, chapters, path) {
    const chaptersOrder = chapters.map(({ order }) => order);
    const missingChapters = [];
    let textToWrite = '';
    for (let i = 1; i <= allChapters.length; ++i) {
      if (chaptersOrder.indexOf(i) == -1) {
        textToWrite += `${allChapters[i - 1]._id}|${allChapters[i - 1].order}|${
          allChapters[i - 1].title
        }|${new Date(allChapters[i - 1].publishedAt)}\r\n`;
        missingChapters.push(allChapters[i - 1]);
      }
    }

    fs.writeFileSync(path, textToWrite);
    return missingChapters;
  }

  async generateEbooks(token: string) {
    if (!token)
      throw new HttpException('Invalid token', HttpStatus.BAD_REQUEST);

    const booksDirectory = path.join(__dirname, '../../exports/');
    const downloadDirectory = path.join(__dirname, '../../downloads/');
    const novelDirectories = this.getDirectories(downloadDirectory);

    await fs.promises.mkdir(booksDirectory, { recursive: true });
    let errorBookId = '';
    for (const novelDirectory of novelDirectories) {
      try {
        const projectDirectory = path.join(novelDirectory, '/project/');
        const projectFile = path.join(
          projectDirectory,
          fs.readdirSync(projectDirectory)[0],
        );

        const book = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        errorBookId = book._id;
        const outputDirectory = path.join(
          booksDirectory,
          this.cleanTitle(book.title),
          '/',
        );
        await fs.promises.mkdir(outputDirectory, { recursive: true });

        const allChaptersList = await this.getChapterList(book._id, token);

        this.getMissingChapters(
          allChaptersList,
          book.chapters,
          outputDirectory + 'missingChapters.txt',
        );

        const chapterContent = book.chapters;
        const totalChapter = book.chapters.length;
        let chapterFrom = 1;
        let chapterTo = 100;
        if (chapterTo > totalChapter) {
          chapterTo = totalChapter;
        }
        while (chapterTo <= totalChapter) {
          const fileName = path.join(
            outputDirectory,
            this.cleanTitle(book.title) + ` ${chapterFrom}-${chapterTo}.epub`,
          );

          if (!fs.existsSync(fileName)) {
            book.chapters = chapterContent.filter(
              (c) => c.order >= chapterFrom && c.order <= chapterTo,
            );
            try {
              await this.generateEpubByPage(book, fileName);
            } catch (err) {
              this.logger.error(err);
            }
          }
          chapterFrom = chapterTo + 1;
          chapterTo = chapterTo + 100;

          if (chapterFrom > totalChapter) {
            break;
          }

          if (chapterTo > totalChapter) {
            chapterTo = totalChapter;
          }
        }
      } catch (err) {
        this.logger.error(
          'Error: Something went wrong in ' + novelDirectory + ' repairing... ',
        );
        await this.downloadBook(errorBookId, token, 'docx', false);
      }
    }
    return { status: 'success' };
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

    const chaptersResult = chapterList.data.chapterList.chapters;
    let i = 1;

    chaptersResult.forEach(function (chapter) {
      chapter.order = i++;
    });
    return chaptersResult;
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

  async getAvailableChapterToPurchase(
    bookId: string,
    token: string,
  ): Promise<any> {
    if (!token) return '';
    const availableChapters = (await this.getChapterList(bookId, token)).filter(
      (chapter) => chapter.isPurchaseRequired,
    );
    return availableChapters;
  }

  async purchaseAllChapters(bookId: string, token: string) {
    if (!token)
      throw new HttpException('token is required', HttpStatus.BAD_REQUEST);
    if (!bookId)
      throw new HttpException('bookId is required', HttpStatus.BAD_REQUEST);
    const isAuthenticated = await this.isAuthenticated(token);
    if (!isAuthenticated) {
      throw new HttpException(
        'User is not authenticated',
        HttpStatus.FORBIDDEN,
      );
    }

    const bookInfo = await this.getBookDetail(bookId, token);

    const allChaptersList = await this.getChapterList(bookId, token);

    const chaptersList = allChaptersList.filter(
      (chapter) => chapter.isPurchaseRequired,
    );

    for (const chapter of chaptersList) {
      const chapterId = chapter._id;
      const price = +chapter.price.goldCoin;

      const query = purchaseChapter;
      const variables = purchaseChaptersVariable;
      variables.chapterId = chapterId;
      variables.input.amount = +price;

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
      const result = JSON.parse(body);
      if (!result.data) {
        this.logger.error(
          `Purchased ${chapter.title} from book ${bookInfo.title} failed!`,
        );
        break;
      }
      this.logger.verbose(
        `Purchased ${chapter.title} from book ${bookInfo.title} successfully!`,
      );
    }
    return { status: 'success' };
  }

  async purchaseAllChaptersToLibrary(bookId: string, token: string) {
    if (!token)
      throw new HttpException('token is required', HttpStatus.BAD_REQUEST);
    if (!bookId)
      throw new HttpException('bookId is required', HttpStatus.BAD_REQUEST);

    const isAuthenticated = await this.isAuthenticated(token);
    if (!isAuthenticated) {
      throw new HttpException(
        'User is not authenticated',
        HttpStatus.FORBIDDEN,
      );
    }

    const bookInfo = await this.getBookDetail(bookId, token);

    const allChaptersList = await this.getChapterList(bookId, token);

    const chaptersList = allChaptersList.filter(
      (chapter) => chapter.isPurchaseRequired,
    );

    const downloadDirectory = path.join(__dirname, '../../downloads/');

    const novelDirectory = path.join(
      downloadDirectory,
      this.cleanTitle(bookInfo.title),
      '/',
    );
    await fs.promises.mkdir(novelDirectory, { recursive: true });

    const exportsDirectory = path.join(novelDirectory, 'exports/');
    await fs.promises.mkdir(exportsDirectory, { recursive: true });

    const rawDirectory = path.join(novelDirectory, 'raw/');
    await fs.promises.mkdir(rawDirectory, { recursive: true });

    const projectDirectory = path.join(novelDirectory, 'project/');
    await fs.promises.mkdir(projectDirectory, { recursive: true });

    const bookProject = `${projectDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.fictionlog`;

    let chapterToPurchase = [];

    if (fs.existsSync(bookProject)) {
      const existedProject = JSON.parse(fs.readFileSync(bookProject, 'utf8'));
      chapterToPurchase = _.differenceBy(
        chaptersList,
        existedProject.chapters,
        '_id',
      );
    } else {
      this.logger.warn(
        'Please download full book first: ' + bookId + ' ' + bookInfo.title,
      );
    }

    for (const chapter of chapterToPurchase) {
      const chapterId = chapter._id;
      const price = +chapter.price.goldCoin;

      const query = purchaseChapter;
      const variables = purchaseChaptersVariable;
      variables.chapterId = chapterId;
      variables.input.amount = +price;

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
      const result = JSON.parse(body);
      if (!result.data) {
        this.logger.error(
          `Purchased ${chapter.title} from book ${bookInfo.title} failed!`,
        );
        break;
      }
      this.logger.verbose(
        `Purchased ${chapter.title} from book ${bookInfo.title} successfully!`,
      );
    }

    await this.downloadBook(bookId, token, 'docx', false);
    return { status: 'success' };
  }

  async downloadBook(
    bookId: string,
    token: string,
    bookType: string,
    isGen: boolean,
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

    const novelDirectory = path.join(
      downloadDirectory,
      this.cleanTitle(bookInfo.title),
      '/',
    );
    await fs.promises.mkdir(novelDirectory, { recursive: true });

    const exportsDirectory = path.join(novelDirectory, 'exports/');
    await fs.promises.mkdir(exportsDirectory, { recursive: true });

    const rawDirectory = path.join(novelDirectory, 'raw/');
    await fs.promises.mkdir(rawDirectory, { recursive: true });

    const projectDirectory = path.join(novelDirectory, 'project/');
    await fs.promises.mkdir(projectDirectory, { recursive: true });

    const bookPathEpub = `${exportsDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.epub`;
    const bookPathWord = `${exportsDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.docx`;
    const bookProject = `${projectDirectory}${this.cleanTitle(
      bookInfo.title,
    )}.fictionlog`;

    const chapters = [];

    // All chapters
    const allChaptersList = await this.getChapterList(bookId, token);

    // Purchased chapters
    const chaptersList = allChaptersList.filter(
      (chapter) => !chapter.isPurchaseRequired,
    );

    for (const chapter of chaptersList) {
      const chapterFile = `${novelDirectory}${this.zero_padding(
        chapter.order,
        5,
      )}_${chapter._id}.txt`;
      const rawFile = `${rawDirectory}${this.zero_padding(chapter.order, 5)}_${
        chapter._id
      }.txt`;

      if (fs.existsSync(rawFile)) {
        const rawCh = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
        chapters.push(rawCh);
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
        _id: chapter._id,
        order: chapter.order,
        title: chapterDetail.title,
        data: chapterRaw,
        blocks: chapterBlocks,
      };

      fs.writeFileSync(chapterFile, chapterRaw);
      fs.writeFileSync(rawFile, JSON.stringify(chapterData));

      chapters.push(chapterData);
    }

    const book = {
      _id: bookId,
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

    const bookName = `${bookInfo.title}.${
      bookType === 'docx' ? 'docx' : 'epub'
    }`;

    if (isGen) {
      this.logger.verbose(`Generating ${bookName}`);
      if (bookType === 'docx') {
        await this.generateWord(book);
      } else {
        await this.generateEpub(book);
      }
    }

    if (fs.existsSync(bookProject)) {
      const existedProject = JSON.parse(fs.readFileSync(bookProject, 'utf8'));
      book.chapters = _.unionBy(book.chapters, existedProject.chapters, '_id');
      book.chapters = _.sortBy(book.chapters, 'order');
    }

    fs.writeFileSync(bookProject, JSON.stringify(book));

    return {
      success: true,
      detail: `The epub/docx has been downloaded and generated`,
      bookPath: `${bookType === 'docx' ? bookPathWord : bookPathEpub}`,
      bookName: bookName,
    };
  }

  async generateEpub(bookInfo): Promise<any> {
    const option = {
      title: bookInfo.title,
      author: bookInfo.author,
      publisher: bookInfo.author,
      cover: bookInfo.coverImage,
      content: bookInfo.chapters,
      verbose: false,
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
          border: {
            bottom: {
              color: 'auto',
              space: 1,
              value: 'single',
              size: 6,
            },
          },
        }),
      );
      for (const paragraph of chapter.blocks) {
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: '\t' + paragraph.text.trim(),
                size: 40,
                font: 'Angsana New',
              }),
            ],
            alignment: 'thaiDistribute' as AlignmentType,
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
              font: 'Angsana New',
              color: '#00D2FF',
            },
            paragraph: {
              spacing: {
                after: 120,
              },
              alignment: AlignmentType.CENTER,
            },
          },
        ],
      },
      sections: sections,
    });
    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(bookInfo.bookPathWord, buffer);
  }

  async generateEpubByPage(bookInfo, outputPath): Promise<any> {
    bookInfo.bookPathEpub = outputPath;
    await this.generateEpub(bookInfo);
  }
}
