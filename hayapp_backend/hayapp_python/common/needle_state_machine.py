from enum import Enum, auto


class NeedleState(Enum):
    VERIFICATION = auto()  # In CIR verification
    ADJUDICATION = auto()  # In CIR adjudication
    VALIDATION = auto()  # In SCR validation
    READJUDICATION = auto()  # In CIR re-adjudication
    COMPLETED = auto()  # Finalized, counted


class NeedleStateMachine:
    def __init__(self, initial_state=NeedleState.VERIFICATION):
        self.state = initial_state

    def transition(self, event: str):
        # Define allowed transitions
        transitions = {
            NeedleState.VERIFICATION: {
                "adjudicate": NeedleState.ADJUDICATION,
                "complete": NeedleState.COMPLETED,
            },
            NeedleState.ADJUDICATION: {
                "validate": NeedleState.VALIDATION,
            },
            NeedleState.VALIDATION: {
                "complete": NeedleState.COMPLETED,
                "readjudicate": NeedleState.READJUDICATION,
            },
            NeedleState.READJUDICATION: {
                "validate": NeedleState.VALIDATION,
            },
            NeedleState.COMPLETED: {},
        }
        if event in transitions[self.state]:
            self.state = transitions[self.state][event]
            return True
        return False

    def get_state(self):
        return self.state

    def is_final(self):
        return self.state in {NeedleState.COMPLETED}


def set_result_state_name(result):
    sm = result.get("needle_state_machine")
    if sm:
        result["needle_state"] = sm.get_state().name
