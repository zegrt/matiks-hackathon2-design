import { useApp } from '../../state';
import { TraceDrawer } from '../TraceDrawer';
import { ChannelsPopover } from './ChannelsPopover';
import { Dialog } from './Dialog';
import { FilterPopover } from './FilterPopover';
import { KeysSheet } from './KeysSheet';
import { MoreMenu } from './MoreMenu';
import { Palette } from './Palette';
import { Toast } from './Toast';

export function Overlays() {
  return <><Overlay /><Toast /></>;
}

function Overlay() {
  const { s, d, cur } = useApp();
  const o = s.overlay;
  switch (o) {
    case null: return null;
    case 'palette': return <Palette />;
    case 'filter': return <FilterPopover />;
    case 'channels': return <ChannelsPopover />;
    case 'keys': return <KeysSheet />;
    case 'more': return cur && <MoreMenu t={cur} />;
    case 'trace': return cur && <><div className="scrim" onClick={() => d({ type: 'close' })} /><TraceDrawer t={cur} /></>;
    default: return <Dialog key={o} kind={o} />;
  }
}
