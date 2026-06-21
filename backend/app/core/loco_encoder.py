from typing import Union
from pydantic import BeforeValidator, PlainSerializer
from typing_extensions import Annotated

def encode_loco_number(loco_val: Union[str, int]) -> int:
    """
    Encodes a locomotive number string (e.g. "65227", "65227A", "65229B")
    or integer (e.g. 65227, 65227001) into the database integer representation.
    """
    if isinstance(loco_val, int):
        # If it's already in the encoded range (e.g. >= 1000000), assume it's already encoded
        # Otherwise if it's a simple number under 1000000, encode it with suffix code 0
        if loco_val >= 1000000:
            return loco_val
        return loco_val * 1000
        
    if not isinstance(loco_val, str):
        raise ValueError("Loco number must be a string or integer")
        
    val_str = loco_val.strip().upper()
    if not val_str:
        raise ValueError("Locomotive number cannot be empty")
        
    if val_str[-1].isalpha():
        base_part = val_str[:-1]
        suffix = val_str[-1]
        suffix_code = ord(suffix) - ord('A') + 1
        if not (1 <= suffix_code <= 26):
            raise ValueError(f"Invalid suffix letter: {suffix}")
    else:
        base_part = val_str
        suffix_code = 0
        
    try:
        base_num = int(base_part)
    except ValueError:
        raise ValueError(f"Invalid base locomotive number: {base_part}")
        
    return base_num * 1000 + suffix_code


def decode_loco_number(loco_num: int) -> str:
    """
    Decodes an integer representation from the database (e.g. 65227000, 65227001)
    back to its locomotive number string (e.g. "65227", "65227A").
    """
    if not isinstance(loco_num, int):
        return str(loco_num)
        
    suffix_code = loco_num % 1000
    base_num = loco_num // 1000
    
    if suffix_code == 0:
        return str(base_num)
    
    if 1 <= suffix_code <= 26:
        suffix_char = chr(ord('A') + suffix_code - 1)
        return f"{base_num}{suffix_char}"
        
    return f"{base_num}X{suffix_code}"


# Pydantic v2 type annotation for automatic validation and serialization
LocoNumberStr = Annotated[
    str,
    BeforeValidator(lambda x: decode_loco_number(x) if isinstance(x, int) else str(x)),
    PlainSerializer(lambda x: x, return_type=str)
]
