import { ReactElement } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';
import { PostSummaryExt } from '../api/types';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { CigarCover } from './CigarCover';

interface PostsGridProps {
  posts: PostSummaryExt[];
  onEndReached?: () => void;
  loadingMore?: boolean;
  ListHeaderComponent?: ReactElement | null;
  emptyMessage?: string;
}

const NUM_COLUMNS = 3;
const GAP = 2;
const ITEM_SIZE = (Dimensions.get('window').width - theme.spacing.md * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function PostsGrid({ posts, onEndReached, loadingMore, ListHeaderComponent, emptyMessage }: PostsGridProps) {
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item }) => {
        const photo = item.media[0];
        return (
          <Pressable style={styles.item} onPress={() => router.push(`/post/${item.id}`)}>
            <CigarCover
              url={photo?.url}
              brand={item.cigar?.brand.name}
              name={item.cigar?.name}
              style={styles.image}
            />
          </Pressable>
        );
      }}
      onEndReachedThreshold={0.5}
      onEndReached={onEndReached}
      ListEmptyComponent={<EmptyState icon="images-outline" message={emptyMessage ?? 'Nenhuma publicação ainda.'} />}
      ListFooterComponent={loadingMore ? <LoadingState /> : null}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  item: { width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2 },
  image: { width: '100%', height: '100%', backgroundColor: theme.colors.surfaceElevated },
  placeholder: { backgroundColor: theme.colors.surfaceElevated },
});
