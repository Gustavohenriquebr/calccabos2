import sys
import re

def refactor_circuit_modal():
    file_path = 'c:/Users/GUSTAVO/Desktop/CalcCabos/frontend/src/components/projeto/CircuitModal.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Inject draft state and useEffect
    state_injection = '''
  const [draftC, setDraftC] = React.useState(modalC || {});

  React.useEffect(() => {
    if (modalC) setDraftC(modalC);
  }, [modalC]);

  if (!draftC || !modalC) return null;
'''
    
    # We find where to inject it: right after the component declaration and before derived state.
    # Look for the start of derived state: `const distZero =`
    inject_idx = content.find('const distZero =')
    if inject_idx != -1:
        content = content[:inject_idx] + state_injection + content[inject_idx:]
    else:
        print("Could not find derived state start.")
        sys.exit(1)
        
    # Step 2: Replace modalC with draftC inside the component body, EXCEPT in the prop list and useEffect.
    # To do this safely, we will split the content at `return (` 
    # Actually derived state also uses `modalC`. It needs to use `draftC`.
    # Let's split content into:
    # 1. Props & State injection (up to `if (!draftC) return null;`)
    # 2. Body (derived state and return)
    
    body_idx = content.find('const distZero =')
    header = content[:body_idx]
    body = content[body_idx:]
    
    # In body, replace all `modalC` with `draftC`, and `setModalC` with `setDraftC`
    body = body.replace('modalC', 'draftC')
    body = body.replace('setModalC', 'setDraftC')
    
    # Except `salvarCircuito(draftC)` is what we want, so replacing `modalC` handles it.
    
    # What about ProtecaoMTATSection props?
    # <ProtecaoMTATSection draftC={draftC} setDraftC={setDraftC} />
    # We will need to change the prop names in ProtecaoMTATSection as well, or just map them:
    # <ProtecaoMTATSection modalC={draftC} setModalC={setDraftC} />
    # Let's keep the props matching the child for now: `<ProtecaoMTATSection modalC={draftC} setModalC={setDraftC} />`
    # Or better, just update ProtecaoMTATSection.jsx to take `draftC`. The user requested: "Migrate from setModalC to setDraftC".
    # I will change `ProtecaoMTATSection` props too.
    
    # Re-assemble
    content = header + body
    
    # Add React.memo to the export
    # The current export is: `export function CircuitModal({`
    # Let's change it to `const CircuitModalComponent = ({` and add `export const CircuitModal = React.memo(CircuitModalComponent);` at the end.
    
    content = content.replace('export function CircuitModal({', 'const CircuitModalComponent = ({')
    content += '\nexport const CircuitModal = React.memo(CircuitModalComponent);\n'
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
def refactor_mtat_section():
    file_path = 'c:/Users/GUSTAVO/Desktop/CalcCabos/frontend/src/components/projeto/ProtecaoMTATSection.jsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace props
    content = content.replace('export function ProtecaoMTATSection({ modalC, setModalC })', 'export function ProtecaoMTATSection({ draftC, setDraftC })')
    
    # Replace all usage
    content = content.replace('modalC.', 'draftC.')
    content = content.replace('modalC?.', 'draftC?.')
    content = content.replace('setModalC(', 'setDraftC(')
    content = content.replace(' modalC ', ' draftC ')
    content = content.replace('(modalC)', '(draftC)')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

refactor_circuit_modal()
refactor_mtat_section()
print("Refactored local state successfully!")
