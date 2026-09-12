import { defineDashboardExtension } from '@vendure/dashboard';

import { blogList } from './blog-list';
import { blogDetail } from './blog-detail';

export default defineDashboardExtension({
    routes: [blogList, blogDetail],
    widgets: [],
});
