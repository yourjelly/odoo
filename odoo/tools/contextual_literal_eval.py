import token
import tokenize
import io
from ast import literal_eval
from collections import deque


def to_string(value):
    if isinstance(value, str):
        return f"\"\"\"{value}\"\"\""  # strings might contain ' and ", but hopefully not """
    return str(value)


def contextual_literal_eval(expr: str, context: dict, record: dict, parent: dict = None):
    try:
        return literal_eval(expr)
    except (ValueError, TypeError):
        readable = io.BytesIO(expr.encode('utf-8'))
        tokens = deque(tokenize.tokenize(readable.readline))
        tokens.popleft()  # remove encoding
        tokens.pop()  # remove newline
        tokens.pop()  # remove endmarker
        processed_tokens = []
        while tokens:
            current = tokens.popleft()  # consume the current token
            if current.type == token.NAME:
                if current.string == "context":
                    # can be either context[name] or context.get(name)
                    n = tokens.popleft()  # remove either . or [
                    if n.type == token.OP and n.string == ".":
                        tokens.popleft()  # remove get
                        tokens.popleft()  # remove (
                    elif n.type != token.OP or n.string != "[":
                        raise ValueError(f"weird token {n.string} in expression {n.line} at position {n.start}")
                    context_key = tokens.popleft()  # remove the context key to retrieve
                    value = context.get(context_key.string[1:-1])  # 'key' => key
                    processed_tokens.append(to_string(value))
                    tokens.popleft()  # remove ) or ]
                if current.string == "parent":
                    # can be either parent[name] or parent.get(name)
                    n = tokens.popleft()  # remove either . or [
                    if n.type == token.OP and n.string == ".":
                        tokens.popleft()  # remove get
                        tokens.popleft()  # remove (
                    elif n.type != token.OP or n.string != "[":
                        raise ValueError(f"weird token {n.string} in expression {n.line} at position {n.start}")
                    context_key = tokens.popleft()  # remove the context key to retrieve
                    value = context.get(parent[context_key.string[1:-1]])  # 'key' => key
                    processed_tokens.append(to_string(value))
                    tokens.popleft()  # remove ) or ]

                elif current.string in record:
                    value = record[current.string]
                    processed_tokens.append(to_string(value))

            else:
                processed_tokens.append(current.string)

        string_literal = "".join(processed_tokens)
        evaluated = literal_eval(string_literal)
        return evaluated


if __name__ == "__main__":
    context = {"long": 115311654321664862165411, "short": 1}
    record = {"id": 34235, "name": "this is the name, it's ra\"ther long"}
    expr = """{"a": context.get("long"), 
    "b": context["short"], "project_id"
    : 
    id, "default_name": name}"""
    actual = contextual_literal_eval(expr, context, record)
    print(actual)
    assert actual == {"a": 115311654321664862165411, "b": 1,
                      "project_id": 34235,
                      "default_name": """this is the name, it's ra"ther long"""}
