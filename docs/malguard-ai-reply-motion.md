# Reply presentation and stop control

The `/ai/` conversation now presents received model replies progressively, with
a subtle caret, retyping activity text, and a monochrome rotating indicator.
Activity text types, briefly rests, and repeats until the phase changes.
The visual target is the quiet, polished interaction requested from Grok. The
existing local Manrope font is used for response and activity typography;
Grok's proprietary font is not bundled or claimed to be an exact match.

Connecting, Thinking, Reading file, Reading website, Searching the web and
Typing correspond to transport, model-start events, browser file reads, the
website-fetch tool, the search tool and local text presentation respectively.
Parallel tool activities remain listed until their own finish events arrive.
These labels do not reveal or invent private model reasoning. The current API
returns complete answers; progressive display does not claim token streaming.

The send arrow becomes a square stop button during cloud requests, local model
work, downloads, and reply presentation. Stop aborts the browser request,
terminates local inference when active, and cancels pending animation frames.
An upstream cloud provider may finish work already submitted; its cancellation
is not guaranteed. Partial visible text is retained with an explicit stopped
label and excluded from subsequent model context. Draft text is preserved.

Enter sends, Shift+Enter inserts a line break, and IME composition is respected.
Reduced motion disables progressive text and continuous animation. Statuses
are localized for Persian/RTL and English/LTR, and announced once per phase.

Validation: `npm run test:ai`, `npm run check:ai`, the existing
`npm run test:ai:browser`, and
`TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/malguard-ai-reply.mjs`.
The dedicated browser suite uses controlled transport and Worker fixtures to
check progressive text, parallel activity, stopping during receipt/display,
local Worker termination, subsequent requests, RTL, and reduced motion.
These tests do not invoke live models, download model weights, or deploy.


## Conversation polish

Activity stays visible and keeps retyping until the response has finished or the
user stops it. Parallel model, search and website checks retain their own labels;
unknown stages are never invented. The local Worker reports model-start separately
from download progress, so inference no longer remains labelled as loading.
English/Persian switching remains available during requests and text presentation.
It updates activity and stop controls without resubmitting or removing partial text.
The gray activity text and its block caret reuse the homepage font and typing style.
Copy and response details are compact, accessible icons below an unboxed reply;
provider identity, citations, security evidence and permissions remain available.

The landing page opens without a model-download popup. Optional on-device model
downloads remain available in Settings, with explicit approval before downloading.
The language choice is shared with the main site and retained on refresh.
