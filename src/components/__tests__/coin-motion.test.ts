import { mapTossToYaoValue } from '../coin-motion';

describe('coin-motion', () => {
    it('maps all toss combinations to valid yao value', () => {
        const cases: [boolean[], number][] = [
            [[true, true, true], 6],
            [[true, true, false], 7],
            [[true, false, true], 7],
            [[false, true, true], 7],
            [[true, false, false], 8],
            [[false, true, false], 8],
            [[false, false, true], 8],
            [[false, false, false], 9],
        ];

        for (const [toss, expected] of cases) {
            expect(mapTossToYaoValue(toss)).toBe(expected);
        }
    });
});
