// 书法字库数据库
// 每个字符在不同碑帖中的图片路径

export interface CalligraphyCharacter {
  char: string
  style: string // kai, xing, cao, li, zhuan
  steleId: string
  steleName: string
  author: string
  imagePath: string
}

// 根据用户提供的书法图片
export const CALLIGRAPHY_DATA: CalligraphyCharacter[] = [
  // 楷书 - 以字
  {
    char: '以',
    style: 'kai',
    steleId: 'duobao',
    steleName: '多宝塔',
    author: '颜真卿',
    imagePath: '/calligraphy/kai/多宝塔.jpg'
  },
  {
    char: '以',
    style: 'kai',
    steleId: 'zhiyongzhencao',
    steleName: '智永真草千字文',
    author: '智永',
    imagePath: '/calligraphy/kai/智永真草千字文.jpg'
  },
  {
    char: '以',
    style: 'kai',
    steleId: 'jihanzhuan',
    steleName: '汲黯传',
    author: '未知',
    imagePath: '/calligraphy/kai/汲黯传.jpg'
  },
  {
    char: '以',
    style: 'kai',
    steleId: 'caotangshizhi',
    steleName: '草堂十志',
    author: '未知',
    imagePath: '/calligraphy/kai/草堂十志.jpg'
  },
  {
    char: '以',
    style: 'kai',
    steleId: 'yanta',
    steleName: '雁塔圣教序',
    author: '褚遂良',
    imagePath: '/calligraphy/kai/雁塔圣教序.jpg'
  },
  
  // 从你的截图中，我看到了以下碑帖的"以"字：
  // - 集字圣教序
  // - 临圣教序
  // - 三宝帖
  // - 酒泉菩萨碑·中秋贴题额
  // - 甘罗帖
  // - 止家记
  // - 向泡帖
  // - 兰亭序
  // - 峻宁又楼
  // - 颜勤贴
  // - 洛神赋
  // - 集宁圣教序
  // - 集宁贴
  // - 赤壁赋
  // - 绪贴帖
  // - 乐毅论
  // - 兰亭贴
  // - 洛神赋帖
  // - 行书圣教序
  // - 单侯秀才
  // - 纸都太帖
  // - 行书洛神赋
  // - 归去来辞
  // - 灾秋深帖
  // - 对雁贴辞片
  // - 行书洛神赋
  // - 洛之宫不留
  // - 兰亭序
  // - 东方朔答客难
  
  // 可以继续添加更多字符和碑帖...
]

// 搜索字符的辅助函数
export function searchCharacterInDatabase(
  char: string,
  style: string
): CalligraphyCharacter[] {
  return CALLIGRAPHY_DATA.filter(
    item => item.char === char && item.style === style
  )
}
