import { createRoot } from 'react-dom/client'
import { ShareProvider } from '../../src/components/Share'
import { CozmlingProvider } from '../../src/cozmling/index'
import { CozmlingApp } from '../../src/cozmling/screens/CozmlingApp'

createRoot(document.getElementById('root')!).render(
  <ShareProvider><CozmlingProvider><main><CozmlingApp /></main></CozmlingProvider></ShareProvider>,
)
