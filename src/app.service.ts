import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import got from 'got';
import * as fs from 'fs';
import * as path from 'path';
import * as epub from 'epub-gen';
import * as docx from 'docx';
import * as officegen from 'officegen';
import * as _ from 'lodash';
import * as util from 'util';
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
  getUserLibraries,
  getUserLibrariesVariable,
  getUserLibrariesVariableNext,
  purchaseChapter,
  purchaseChaptersVariable,
  requestUrl,
} from './schemas/fictionlog-schema';
import { AlignmentType, HeadingLevel, ImageRun, Paragraph } from 'docx';
import { Logger } from '@nestjs/common';
import { forEach } from 'lodash';

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

  getTokens(srcPath) {
    return fs
      .readdirSync(srcPath)
      .map((file) => path.join(srcPath, file))
      .filter((path) => fs.statSync(path).isFile() && path.includes('.text'));
  }

  getMissingChapters(allChapters, chapters, path) {
    const chaptersOrder = chapters.map(({ order }) => order);
    const missingChapters = [];
    let textToWrite = '';
    for (let i = 1; i <= allChapters.length; ++i) {
      if (chaptersOrder.indexOf(i) == -1) {
        textToWrite += `${allChapters[i - 1]._id}|${allChapters[i - 1].order}|${
          allChapters[i - 1].title
        }|${new Date(allChapters[i - 1].publishedAt).toLocaleString()}\r\n`;
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
    let workCount = 1;

    while (novelDirectories.length) {
      await Promise.allSettled(
        novelDirectories.splice(0, 5).map(async (novelDirectory) => {
          try {
            const projectDirectory = path.join(novelDirectory, '/project/');
            const projectFile = path.join(
              projectDirectory,
              fs.readdirSync(projectDirectory)[0],
            );

            let book = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
            this.logger.verbose(
              `[ Current Work: ${workCount++} | Left: ${
                novelDirectories.length
              } ] Processing... ${book.title}`,
            );
            try {
              const bookData = await this.downloadBook(
                book._id,
                token,
                'docx',
                false,
              );
              book = bookData.book;
            } catch (err) {
              this.logger.warn('The book is invalid or discontinued');
            }

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
              const fileNameEpub = path.join(
                outputDirectory,
                this.cleanTitle(book.title) +
                  ` ${chapterFrom}-${chapterTo}.epub`,
              );

              const fileNameWord = path.join(
                outputDirectory,
                this.cleanTitle(book.title) +
                  ` ${chapterFrom}-${chapterTo}.docx`,
              );

              book.chapters = chapterContent.filter(
                (c) => c.order >= chapterFrom && c.order <= chapterTo,
              );

              if (!fs.existsSync(fileNameEpub)) {
                try {
                  await this.generateEpubByPage(book, fileNameEpub);
                } catch (err) {
                  this.logger.error(err);
                }
              }

              if (!fs.existsSync(fileNameWord)) {
                try {
                  await this.generateWordByPage(book, fileNameWord);
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
              'Error: Something went wrong in ' +
                novelDirectory +
                ' repairing... ',
            );
            await this.downloadBook(errorBookId, token, 'docx', false);
          }
        }),
      );
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

  async getAllBooksInLibraries(token: string) {
    if (!token) return [];
    const query = getUserLibraries;
    const variables = getUserLibrariesVariable;
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
    let librariesResponse = JSON.parse(body);
    if (
      !librariesResponse.data?.libraries ||
      librariesResponse.data.libraries.edges.length == 0
    )
      return [];

    const bookId = [];
    for (const bookData of librariesResponse.data.libraries.edges) {
      bookId.push(bookData.node.book._id);
    }

    while (librariesResponse.data.libraries.pageInfo.hasNextPage == true) {
      const v = {
        ...getUserLibrariesVariableNext,
      };
      v.filter.beforeCursor =
        librariesResponse.data.libraries.pageInfo.endCursor;
      const b = (
        await got.post(requestUrl, {
          body: JSON.stringify({
            query: query,
            variables: v,
          }),
          headers: {
            authorization: `JWT ${token}`,
            'Content-Type': 'application/json',
          },
          retry: {
            limit: 3,
            methods: ['GET', 'POST'],
          },
        })
      ).body;
      librariesResponse = JSON.parse(b);
      for (const bookData of librariesResponse.data.libraries.edges) {
        bookId.push(bookData.node.book._id);
      }
    }

    return bookId;
  }

  async refreshLibrariesAllToken() {
    const tokenDirectory = path.join(__dirname, '../../tokens/');
    const tokenFiles = this.getTokens(tokenDirectory);
    const tokenConfig = 'TOKEN=';

    this.logger.verbose(
      'Begin refreshing libraries for ' + tokenFiles.length + ' tokens',
    );
    let tokenIndex = 1;
    for (const tFile of tokenFiles) {
      const fileContent = fs
        .readFileSync(tFile, { encoding: 'utf8' })
        .replace(/\r|\n/g, '|');

      const token = fileContent.substring(
        fileContent.indexOf(tokenConfig) + tokenConfig.length,
      );

      const authResult = await this.isAuthenticated(token);

      if (!authResult) {
        continue;
      }

      //Get All Book
      const bookIds = await this.getAllBooksInLibraries(token);
      let bookIndex = 1;

      for (const bookId of bookIds) {
        this.logger.verbose(
          `[ ${tokenIndex} of ${
            tokenFiles.length
          } ] Processing book ${bookIndex++} of ${bookIds.length}`,
        );
        await this.downloadBook(bookId, token, 'docx', false);
      }
      // for (const bookId of bookIds) {
      //   this.logger.verbose(
      //     `[ ${tokenIndex} of ${
      //       tokenFiles.length
      //     } ] Processing book ${bookIndex++} of ${bookIds.length}`,
      //   );
      //   await this.downloadBook(bookId, token, 'docx', false);
      // }
      ++tokenIndex;
    }
    return { status: 'success' };
  }

  async clearTokens() {
    const tokenDirectory = path.join(__dirname, '../../tokens/');
    const tokenFiles = this.getTokens(tokenDirectory);
    const tokenConfig = 'TOKEN=';
    const coinConfig = 'GOLDCOIN=';
    for (const tFile of tokenFiles) {
      const fileContent = fs
        .readFileSync(tFile, { encoding: 'utf8' })
        .replace(/\r|\n/g, '|');

      const token = fileContent.substring(
        fileContent.indexOf(tokenConfig) + tokenConfig.length,
      );

      const authResult = await this.isAuthenticated(token);

      // const moneyResult = fileContent.substring(
      //   fileContent.indexOf(coinConfig) + coinConfig.length,
      //   fileContent.indexOf('TEL=') - 1,
      // );

      if (!authResult) {
        fs.unlinkSync(tFile);
      }
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
    let bookInfo;
    try {
      bookInfo = await this.getBookDetail(bookId, token);
    } catch (err) {
      this.logger.error(err);
    }

    if (!bookInfo) {
      return {
        success: false,
        detail: `Error: Invalid book id`,
      };
    }

    if (!isGen) {
      this.logger.verbose('Scraping... ' + bookInfo.title);
    }
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

    const chapterWorker = JSON.parse(JSON.stringify(chaptersList));

    while (chapterWorker.length) {
      await Promise.allSettled(
        chapterWorker.splice(0, 25).map(async (chapter) => {
          const chapterFile = `${novelDirectory}${this.zero_padding(
            chapter.order,
            5,
          )}_${chapter._id}.txt`;
          const rawFile = `${rawDirectory}${this.zero_padding(
            chapter.order,
            5,
          )}_${chapter._id}.txt`;

          if (fs.existsSync(rawFile)) {
            const rawCh = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
            chapters.push(rawCh);
            return;
          }

          const chapterDetail = await this.getChapterDetail(chapter._id, token);
          let chapterBlocks;
          try {
            chapterBlocks = chapterDetail.contentRawState.blocks
              .map(({ text, type }) => ({
                text,
                type,
              }))
              .filter(({ text }) => text.length >= 2);
          } catch (err) {
            return;
          }

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
        }),
      );
    }

    const book = {
      _id: bookId,
      title: bookInfo.title,
      coverImage: bookInfo.coverImage,
      description: bookInfo.description,
      fullDescription: bookInfo.contentRawState?.blocks || '',
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

    book.chapters = _.sortBy(book.chapters, 'order');

    if (isGen) {
      this.logger.verbose(`Generating... ${bookName}`);
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
      bookPath: path.resolve(
        `${bookType === 'docx' ? bookPathWord : bookPathEpub}`,
      ),
      bookName: bookName,
      book: book,
    };
  }

  async generateEpub(bookInfo): Promise<any> {
    let fullDesc = '';
    const newEpubChapter = JSON.parse(JSON.stringify(bookInfo.chapters));
    if (bookInfo.fullDescription?.length > 0) {
      for (const desc of bookInfo.fullDescription) {
        fullDesc += '<p>' + desc.text.trim() + '</p>';
      }

      const briefDescription = {
        title: 'รายละเอียด',
        data: fullDesc,
      };
      newEpubChapter.unshift(briefDescription);
    }

    const customCss = `
    @font-face {
      font-family: "THSarabunNew";
      font-style: normal;
      font-weight: normal;
      src : url("./fonts/THSarabunNew.ttf");
    }

    p { 
      font-family: "THSarabunNew";
    }

    h1 { 
      font-family: "THSarabunNew";
    }

    * { 
      font-family: "THSarabunNew";
    }
  `;

    const option = {
      title: bookInfo.title,
      author: bookInfo.author,
      publisher: bookInfo.author,
      cover: bookInfo.coverImage,
      content: newEpubChapter,
      lang: 'th',
      fonts: [path.join(__dirname, '../../fonts/THSarabunNew.ttf')],
      css: customCss,
      verbose: false,
      tocTitle: 'สารบัญ',
    };
    await new epub(option, bookInfo.bookPathEpub).promise;
  }

  async generateWord(bookInfo): Promise<any> {
    const sections = [];
    const imageBuffer = (
      await got.get(bookInfo.coverImage, { responseType: 'buffer' })
    ).body;

    // Construct Cover and ToC
    const coverImage = new ImageRun({
      data: imageBuffer,
      transformation: {
        width: 559,
        height: 794,
      },
      floating: {
        horizontalPosition: {
          offset: 0,
        },
        verticalPosition: {
          offset: 0,
        },
      },
    });

    const coverSection = {
      properties: {
        type: docx.SectionType.NEXT_PAGE,
        page: {
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720,
          },
          size: {
            width: 8390.55,
            height: 11905.51,
          },
        },
      },
      children: [
        new docx.Paragraph({
          children: [coverImage],
        }),
      ],
    };

    const tocSection = {
      properties: {
        page: {
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720,
          },
          size: {
            width: 8390.55,
            height: 11905.51,
          },
        },
      },
      children: [
        new docx.Paragraph({
          text: 'สารบัญ',
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
        new docx.TableOfContents('สารบัญ', {
          hyperlink: true,
          headingStyleRange: '1-1',
        }),
      ],
    };

    let briefDescriptionSection = {};

    // Construct Brief Description
    if (bookInfo.fullDescription?.length > 0) {
      const paragraphs = [];
      paragraphs.push(
        new docx.Paragraph({
          text: 'รายละเอียด',
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
      for (const desc of bookInfo.fullDescription) {
        paragraphs.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: '\t' + desc.text.trim(),
                size: 40,
                font: 'TH Sarabun New',
              }),
            ],
            alignment: 'thaiDistribute' as AlignmentType,
          }),
        );
      }
      briefDescriptionSection = {
        properties: {
          type: docx.SectionType.NEXT_PAGE,
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
            size: {
              width: 8390.55,
              height: 11905.51,
            },
          },
        },
        children: paragraphs,
      };
    }

    const contentSection = [];

    // Construct Contents
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
                font: 'TH Sarabun New',
              }),
            ],
            alignment: 'thaiDistribute' as AlignmentType,
          }),
        );
      }
      const content = {
        properties: {
          type: docx.SectionType.NEXT_PAGE,
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
            size: {
              width: 8390.55,
              height: 11905.51,
            },
          },
        },
        children: paragraphs,
      };

      contentSection.push(content);
    }

    sections.push(coverSection);
    sections.push(tocSection);
    if (bookInfo.fullDescription?.length > 0)
      sections.push(briefDescriptionSection);

    for (const content of contentSection) {
      sections.push(content);
    }

    const doc = new docx.Document({
      creator: 'Created By Fictionlog Downloader v' + version,
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
              font: 'TH Sarabun New',
              color: '#50A8F2',
            },
            paragraph: {
              spacing: {
                after: 120,
              },
              alignment: AlignmentType.CENTER,
            },
          },
          {
            id: 'TOC1',
            name: 'toc 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            paragraph: {},
            run: {
              font: 'TH Sarabun New',
              color: '#000000',
              size: 40,
            },
          },
        ],
      },
      sections: sections,
    });

    doc.Settings.addUpdateFields();
    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(bookInfo.bookPathWord, buffer);
  }

  async generateWordExt(bookInfo): Promise<any> {
    const docx = officegen('docx');

    for (const chapter of bookInfo.chapters) {
      let pObj = docx.createP();
      pObj.addText(chapter.title, {
        font_face: 'TH Sarabun New',
        font_size: 40,
      });
      pObj.addHorizontalLine();
      for (const paragraph of chapter.blocks) {
        pObj = docx.createP();
        pObj.addText('\t' + paragraph.text.trim(), {
          font_face: 'TH Sarabun New',
          font_size: 20,
        });
      }
      docx.putPageBreak();
    }

    const out = fs.createWriteStream(bookInfo.bookPathWord);
    await docx.generate(out);
  }

  async generateEpubByPage(bookInfo, outputPath): Promise<any> {
    bookInfo.bookPathEpub = outputPath;
    await this.generateEpub(bookInfo);
  }

  async generateWordByPage(bookInfo, outputPath): Promise<any> {
    bookInfo.bookPathWord = outputPath;
    await this.generateWord(bookInfo);
  }
}
