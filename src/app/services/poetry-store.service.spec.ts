import { PoetryStoreService } from './poetry-store.service';
import type { MarkTone } from '../models/poem.models';

const FIVE_CHAR_TEXT = '甲乙丙丁戊\n己庚辛壬癸\n子丑寅卯辰\n巳午未申酉';

function makeService(toneGrid: (MarkTone | null)[][]): PoetryStoreService {
  const service = new PoetryStoreService();
  const workspace = service.workspace();
  const marks: Record<string, { tone: MarkTone; rhyme: string; pauseAfter: boolean; basis: string; note: string }> = {};
  toneGrid.forEach((tones, line) => {
    tones.forEach((tone, position) => {
      if (tone) marks[`${line}:${position}`] = { tone, rhyme: '', pauseAfter: false, basis: '', note: '' };
    });
  });
  const version = { ...workspace.versions[0], text: FIVE_CHAR_TEXT, marks, antithesisPairs: [] };
  service.workspace.set({ ...workspace, templateId: 'wuyan-zeqi', versions: [version], activeVersionId: version.id });
  return service;
}

const QUIET_LINES: (MarkTone | null)[][] = [
  ['平', '平', '仄', '仄', '仄'],
  ['平', '仄', '平', '仄', '仄'],
  ['平', '平', '仄', '平', '平'],
];

describe('PoetryStoreService 孤平与三平尾收紧', () => {
  it('平收句除韵脚外仅剩一个平声时判孤平，并在字格上与普通出律分开', () => {
    const service = makeService([['仄', '平', '仄', '仄', '平'], ...QUIET_LINES]);
    const line = service.analysis()[0];
    expect(line.flaws).toContain('isolated');
    expect(line.cells[1].status).toBe('isolated');
    expect(line.errors).toBeGreaterThanOrEqual(1);
    expect(service.issues().some((issue) => issue.title === '孤平出律' && issue.level === 'error')).toBeTrue();
    expect(service.issues().some((issue) => issue.id === 'meter-ok')).toBeFalse();
    expect(service.exportProofreadCopy()).toContain('【孤平】');
  });

  it('句末三字连平时判三平尾，三字一并标出', () => {
    const service = makeService([['仄', '仄', '平', '平', '平'], ...QUIET_LINES]);
    const line = service.analysis()[0];
    expect(line.flaws).toContain('triple');
    expect([line.cells[2].status, line.cells[3].status, line.cells[4].status]).toEqual(['triple', 'triple', 'triple']);
    expect(service.issues().some((issue) => issue.title === '三平尾出律' && issue.level === 'error')).toBeTrue();
    expect(service.exportProofreadCopy()).toContain('【三平尾】');
  });

  it('仄声收尾的句子不受孤平限制', () => {
    const service = makeService([['仄', '仄', '仄', '平', '仄'], ...QUIET_LINES]);
    expect(service.analysis()[0].flaws).not.toContain('isolated');
  });

  it('平仄未标定或两可的字先不下结论', () => {
    const unmarked = makeService([[null, '平', '仄', '仄', '平'], ...QUIET_LINES]);
    expect(unmarked.analysis()[0].flaws).not.toContain('isolated');
    const flexible = makeService([['中', '平', '仄', '仄', '平'], ...QUIET_LINES]);
    expect(flexible.analysis()[0].flaws).not.toContain('isolated');
    const tailOpen = makeService([['仄', '仄', '平', '平', null], ...QUIET_LINES]);
    expect(tailOpen.analysis()[0].flaws).not.toContain('triple');
  });

  it('孤平句中一三五位置的仄声变体不再放行，其余变体照旧', () => {
    // 第四句模板为「平中仄中平」，首字应平而仄，本属一三五变体
    const isolated = makeService([
      ['仄', '仄', '中', '平', '仄'],
      ['中', '平', '中', '仄', '仄'],
      ['中', '平', '中', '仄', '中'],
      ['仄', '平', '仄', '仄', '平'],
    ]);
    expect(isolated.analysis()[3].flaws).toContain('isolated');
    expect(isolated.analysis()[3].cells[0].status).toBe('isolated');

    const acceptable = makeService([
      ['平', '仄', '中', '平', '仄'],
      ['中', '平', '中', '仄', '仄'],
      ['中', '平', '中', '仄', '中'],
      ['平', '中', '仄', '中', '平'],
    ]);
    expect(acceptable.analysis()[0].cells[0].status).toBe('variant');
    expect(acceptable.analysis()[0].flaws.length).toBe(0);
  });

  it('韵脚外有两个平声的平收句不误判孤平', () => {
    const service = makeService([['平', '平', '仄', '仄', '平'], ...QUIET_LINES]);
    expect(service.analysis()[0].flaws).not.toContain('isolated');
  });

  it('检查结果与导出校对稿按同一套判断', () => {
    const service = makeService([
      ['仄', '平', '仄', '仄', '平'],
      ['仄', '仄', '平', '平', '平'],
      ['平', '仄', '平', '仄', '仄'],
      ['平', '平', '仄', '平', '平'],
    ]);
    const copy = service.exportProofreadCopy();
    expect(copy).toContain('孤平出律');
    expect(copy).toContain('三平尾出律');
    expect(copy).toContain('【孤平】');
    expect(copy).toContain('【三平尾】');
  });
});
