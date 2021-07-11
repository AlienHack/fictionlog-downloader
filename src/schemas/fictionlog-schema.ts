export const requestUrl = `https://api.k8s.fictionlog.co/graphql`;

export const getChapterDetailQuery = `
query ChapterDetail($chapterId: ID!) {
  chapter(chapterId: $chapterId) {
    _id
    title
    contentRawState
    isWriter
    status
    publishedAt
    isPurchaseRequired
    priceId
    userId
    viewsCount
    chapterCommentsCount
    chapterNumber
    note
    purchased
    supported
    supportGoldCoinPrice
    price {
      type
      goldCoin
      __typename
    }
    user {
      _id
      displayName
      username
      profileImage
      __typename
    }
    nextChapter {
      _id
      title
      status
      purchased
      bookId
      isPurchaseRequired
      chapterNumber
      price {
        type
        goldCoin
        __typename
      }
      book {
        ...BookInChapterDetail
        __typename
      }
      __typename
    }
    editChapter {
      _id
      title
      contentRawState
      status
      rejectNote
      __typename
    }
    book {
      ...BookInChapterDetail
      __typename
    }
    __typename
  }
}

fragment BookInChapterDetail on Book {
  _id
  title
  description
  coverImage
  addedToLibrary
  hasPaidChapter
  bundlePurchased
  contentType
  completed
  placeholderBackgroundColor
  activatedAt
  enableSupport
  productSet {
    _id
    __typename
  }
  chaptersCount {
    public
    __typename
  }
  user {
    _id
    __typename
  }
  categories {
    _id
    name
    slug
    __typename
  }
  bundlePrice {
    goldCoin
    __typename
  }
  totalPrice {
    goldCoin
    __typename
  }
  __typename
}`;

export const getChapterDetailVariable = {
  chapterId: '5fd736a0f25225001b207844',
};

export const getChapterListQuery = `
query ChapterListInChapterDetail($bookId: ID!, $filter: ChapterListFilter) {
    chapterList(bookId: $bookId, filter: $filter) {
      chapters {
        _id
        title
        viewsCount
        chapterCommentsCount
        isPurchaseRequired
        publishedAt
        status
        priceId
        viewed
        book {
          _id
          __typename
        }
        price {
          type
          goldCoin
          __typename
        }
        __typename
      }
      __typename
    }
  }
  `;

export const getChapterListVariable = {
  bookId: '5fbbfd931c156e001b8282af',
};
export const getBookDetailQuery = `
query BookInBookDetail($bookId: ID!) {
    book(bookId: $bookId) {
      ...book
      neighbors {
        ...neighborBook
        __typename
      }
      productSet {
        _id
        productType
        contentType
        title
        productsCount {
          public
          __typename
        }
        products(filter: {limit: 12}) {
          edges {
            node {
              ... on Book {
                ...bookNodeInProducts
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
  
  fragment book on Book {
    _id
    authorName
    translatorName
    addedToLibrary
    bundlePurchased
    chapterCommentsCount
    completed
    contentRawState
    contentType
    coverImage
    description
    hashtags
    hasPaidChapter
    inLibrariesCount
    isWriter
    latestChapterPublishedAt
    latestViewedChapter
    placeholderBackgroundColor
    status
    title
    viewsCount
    canSellBundle
    enableSupport
    bundlePrice {
      goldCoin
      __typename
    }
    bundlePriceTierDetail {
      _id
      discount
      __typename
    }
    categories {
      _id
      name
      slug
      __typename
    }
    contentRating {
      _id
      name
      iconImageUrl
      description
      warning
      __typename
    }
    chaptersCount {
      public
      draft
      scheduled
      total
      __typename
    }
    totalPrice {
      goldCoin
      __typename
    }
    userReviewsCount {
      total
      __typename
    }
    user {
      _id
      username
      displayName
      profileImage
      description
      socialFacebookLink
      socialTwitterLink
      booksCount
      ebooksCount
      followersCount
      relation
      __typename
    }
    __typename
  }
  
  fragment neighborBook on Book {
    _id
    coverImage
    placeholderBackgroundColor
    title
    completed
    viewsCount
    chapterCommentsCount
    categories {
      _id
      name
      __typename
    }
    contentRating {
      _id
      name
      __typename
    }
    chaptersCount {
      public
      __typename
    }
    bundlePriceTierDetail {
      _id
      discount
      __typename
    }
    user {
      _id
      displayName
      __typename
    }
    __typename
  }
  
  fragment bookNodeInProducts on Book {
    _id
    coverImage
    placeholderBackgroundColor
    title
    completed
    viewsCount
    chapterCommentsCount
    chaptersCount {
      public
      __typename
    }
    bundlePriceTierDetail {
      _id
      discount
      __typename
    }
    categories {
      _id
      name
      __typename
    }
    contentRating {
      _id
      name
      __typename
    }
    __typename
  }
  `;

export const getBookDetailVariable = {
  bookId: '5fbbfd931c156e001b8282af',
};

export const getUserDetailQuery = `
{
  user(owner: true) {
    ...currentUser
    __typename
  }
}

fragment currentUser on User {
  _id
  address
  currentThbEarnings
  displayName
  facebookId
  email
  enableNCContent
  goldCoin
  profileImage
  tel
  type
  username
  feedPref
  relation
  hasPassword
  canChangeUsername
  booksCount
  ebooksCount
  registeredTaxDeduction
  coverImage
  description
  socialFacebookLink
  socialTwitterLink
  __typename
}
  `;

export const getUserDetailVariable = {};

export const purchaseChapter = `mutation PurchaseChapterInChapterDetail($chapterId: ID!, $input: PurchaseInput!) {
  purchaseChapter(chapterId: $chapterId, input: $input) {
    _id
    title
    contentRawState
    isWriter
    status
    publishedAt
    isPurchaseRequired
    priceId
    userId
    viewsCount
    chapterCommentsCount
    chapterNumber
    note
    price {
      type
      goldCoin
      __typename
    }
    user {
      _id
      displayName
      username
      profileImage
      __typename
    }
    nextChapter {
      _id
      title
      status
      purchased
      bookId
      price {
        type
        goldCoin
        __typename
      }
      __typename
    }
    editChapter {
      _id
      title
      contentRawState
      status
      rejectNote
      __typename
    }
    book {
      ...BookInChapterDetail
      __typename
    }
    __typename
  }
}

fragment BookInChapterDetail on Book {
  _id
  title
  description
  coverImage
  addedToLibrary
  hasPaidChapter
  bundlePurchased
  contentType
  completed
  placeholderBackgroundColor
  activatedAt
  enableSupport
  productSet {
    _id
    __typename
  }
  chaptersCount {
    public
    __typename
  }
  user {
    _id
    __typename
  }
  categories {
    _id
    name
    slug
    __typename
  }
  bundlePrice {
    goldCoin
    __typename
  }
  totalPrice {
    goldCoin
    __typename
  }
  __typename
}
`;

export const purchaseChaptersVariable = {
  chapterId: '',
  input: {
    coinType: 'goldCoin',
    amount: 300,
  },
};
