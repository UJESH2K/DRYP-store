import { useRouter } from 'expo-router';
import { useNavigationStore } from '../state/navigation';

export function useCustomRouter() {
  const router = useRouter();
  const { push: pushToHistory, goBack: goBackFromHistory } = useNavigationStore();

  const push = (path: string | { pathname: string, params: any }, params?: any) => {
    if (typeof path === 'string') {
      pushToHistory(path);
      router.push(path);
    } else {
      pushToHistory(path.pathname);
      router.push(path);
    }
  };

  const replace = (path: string | { pathname: string, params: any }, params?: any) => {
    if (typeof path === 'string') {
      pushToHistory(path);
      router.replace(path);
    } else {
      pushToHistory(path.pathname);
      router.replace(path);
    }
  };

  const goBack = (params?: any) => {
    const backPath = goBackFromHistory();
    if (backPath) {
      router.replace({ pathname: backPath, params });
    } else {
      router.back();
    }
  };

  return {
    ...router,
    push,
    replace,
    goBack,
  };
}