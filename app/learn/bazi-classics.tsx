import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import StatusBarDecor from '../../src/components/StatusBarDecor';
import { BackIcon, ChevronRightIcon, ReadIcon } from '../../src/components/Icons';
import {
    BAZI_CLASSIC_BOOK_INDEX,
    getBaziClassicBook,
    type BaziClassicBook,
    type BaziClassicBookMeta,
    type BaziClassicChapter,
} from '../../src/data/bazi-classics';
import { BorderRadius, FontSize, Spacing } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';

type RootListItem =
    | { type: 'intro' }
    | { type: 'bookHeader' }
    | { type: 'book'; book: BaziClassicBookMeta };

function splitChapterText(text: string): string[] {
    return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

export default function BaziMatchClassicsPage() {
    const { Colors } = useTheme();
    const styles = makeStyles(Colors);
    const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

    const selectedBook = useMemo(
        () => selectedBookId ? getBaziClassicBook(selectedBookId) : null,
        [selectedBookId],
    );
    const selectedChapter = useMemo(
        () => selectedBook?.chapters.find((chapter) => chapter.id === selectedChapterId) || null,
        [selectedBook, selectedChapterId],
    );
    const rootItems = useMemo<RootListItem[]>(() => [
        { type: 'intro' },
        { type: 'bookHeader' },
        ...BAZI_CLASSIC_BOOK_INDEX.map((book) => ({ type: 'book' as const, book })),
    ], []);
    const chapterParagraphs = useMemo(
        () => selectedChapter ? splitChapterText(selectedChapter.text) : [],
        [selectedChapter],
    );

    const handleBack = () => {
        if (selectedChapter) {
            setSelectedChapterId(null);
            return;
        }
        if (selectedBook) {
            setSelectedBookId(null);
            return;
        }
        router.back();
    };

    const renderRootItem = ({ item }: { item: RootListItem }) => {
        if (item.type === 'intro') {
            return (
                <View style={styles.introCard}>
                    <View style={styles.introIcon}>
                        <ReadIcon size={26} color={Colors.accent.gold} />
                    </View>
                    <View style={styles.introTextWrap}>
                        <Text style={styles.introTitle}>命理典籍</Text>
                        <Text style={styles.introText}>
                            这里统一收录八字命理相关古籍原文，方便按书、按篇阅读查考。
                        </Text>
                    </View>
                </View>
            );
        }
        if (item.type === 'bookHeader') {
            return <Text style={styles.sectionTitle}>典籍全本</Text>;
        }
        return (
            <TouchableOpacity style={styles.bookCard} activeOpacity={0.78} onPress={() => setSelectedBookId(item.book.id)}>
                <View style={styles.bookMain}>
                    <Text style={styles.bookTitle}>{item.book.title}</Text>
                    <Text style={styles.bookMeta}>{item.book.dynasty} · {item.book.author} · {item.book.chapterCount} 篇</Text>
                    <Text style={styles.bookDesc}>约 {Math.round(item.book.charCount / 1000)} 千字</Text>
                </View>
                <ChevronRightIcon size={18} color={Colors.text.tertiary} />
            </TouchableOpacity>
        );
    };

    const renderChapterItem = ({ item, index }: { item: BaziClassicChapter; index: number }) => (
        <TouchableOpacity style={styles.chapterCard} activeOpacity={0.78} onPress={() => setSelectedChapterId(item.id)}>
            <View style={styles.chapterIndexBox}>
                <Text style={styles.chapterIndex}>{index + 1}</Text>
            </View>
            <View style={styles.bookMain}>
                <Text style={styles.chapterTitle}>{item.title}</Text>
                <Text style={styles.bookDesc}>约 {item.text.length} 字</Text>
            </View>
            <ChevronRightIcon size={18} color={Colors.text.tertiary} />
        </TouchableOpacity>
    );

    const renderParagraph = ({ item, index }: { item: string; index: number }) => (
        <Text style={[styles.paragraph, index === 0 && styles.paragraphLead]}>{item}</Text>
    );

    const title = selectedChapter?.title || selectedBook?.title || '命理典籍';

    return (
        <View style={styles.container}>
            <StatusBarDecor />
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
                    <BackIcon size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                <View style={styles.iconBtn} />
            </View>

            {!selectedBook ? (
                <FlatList
                    data={rootItems}
                    keyExtractor={(item, index) => `${item.type}-${index}`}
                    renderItem={renderRootItem}
                    contentContainerStyle={styles.listBody}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={8}
                />
            ) : selectedChapter ? (
                <FlatList
                    data={chapterParagraphs}
                    keyExtractor={(_, index) => `${selectedChapter.id}-${index}`}
                    renderItem={renderParagraph}
                    ListHeaderComponent={(
                        <View style={styles.readerHeader}>
                            <Text style={styles.readerBook}>{selectedBook.title}</Text>
                            <Text style={styles.readerTitle}>{selectedChapter.title}</Text>
                            <Text style={styles.readerSource}>{selectedBook.dynasty} · {selectedBook.author}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.readerBody}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={16}
                />
            ) : (
                <FlatList
                    data={selectedBook.chapters}
                    keyExtractor={(item) => item.id}
                    renderItem={renderChapterItem}
                    ListHeaderComponent={(
                        <View style={styles.bookDetailHeader}>
                            <Text style={styles.bookTitle}>{selectedBook.title}</Text>
                            <Text style={styles.bookMeta}>{selectedBook.dynasty} · {selectedBook.author}</Text>
                            <Text style={styles.bookDesc}>{selectedBook.chapters.length} 篇 · 约 {Math.round(selectedBook.chapters.reduce((sum, chapter) => sum + chapter.text.length, 0) / 1000)} 千字</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.listBody}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={14}
                />
            )}
        </View>
    );
}

const makeStyles = (Colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 0.5,
        borderColor: Colors.border.subtle,
    },
    iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '500', textAlign: 'center' },
    listBody: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },
    introCard: {
        flexDirection: 'row',
        gap: Spacing.md,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.lg,
    },
    introIcon: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    introTextWrap: { flex: 1, gap: Spacing.xs },
    introTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '700' },
    introText: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 21 },
    sectionTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.sm },
    bookCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    bookMain: { flex: 1, gap: 4 },
    bookTitle: { color: Colors.text.heading, fontSize: FontSize.lg, fontWeight: '700' },
    bookMeta: { color: Colors.text.secondary, fontSize: FontSize.sm },
    bookDesc: { color: Colors.text.tertiary, fontSize: FontSize.xs, lineHeight: 18 },
    bookDetailHeader: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.lg,
        gap: Spacing.xs,
    },
    chapterCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    chapterIndexBox: {
        width: 34,
        height: 34,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.bg.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chapterIndex: { color: Colors.accent.gold, fontSize: FontSize.sm, fontWeight: '700' },
    chapterTitle: { color: Colors.text.heading, fontSize: FontSize.md, fontWeight: '600' },
    readerBody: { padding: Spacing.lg, paddingBottom: 60 },
    readerHeader: {
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        backgroundColor: Colors.bg.card,
        padding: Spacing.lg,
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    readerBook: { color: Colors.text.secondary, fontSize: FontSize.sm },
    readerTitle: { color: Colors.text.heading, fontSize: FontSize.xl, fontWeight: '700' },
    readerSource: { color: Colors.text.tertiary, fontSize: FontSize.xs },
    paragraph: { color: Colors.text.primary, fontSize: FontSize.md, lineHeight: 28, marginBottom: Spacing.md },
    paragraphLead: { color: Colors.accent.goldLight, fontWeight: '700' },
});
