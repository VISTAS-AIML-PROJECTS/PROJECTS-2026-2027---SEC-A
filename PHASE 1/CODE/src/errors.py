class MineError(Exception):
    """User-facing pipeline error with what / why / next step."""

    def __init__(self, what, why, action):
        self.what = what
        self.why = why
        self.action = action
        message = (
            f"{what}\n"
            f"Why: {why}\n"
            f"What to do: {action}"
        )
        super().__init__(message)


def pipeline_error(what, why, action):
    raise MineError(what, why, action)
