# Serial Protocol
## Serial Interface Settings
Baudrate: 115200
Data Bits: 8
Parity: None
Stop Bits: 1
Flow Control: Off

## Serial Packet Structure
All packets must have a COMMAND, SEQ_ID, and LENGTH section. DATA and CRC are optional. 
All packets must start with ‘[‘ and end with ‘]’
All packets must use the ‘|’ character to separate sections.

## Serial Packet Format
The serial packet will be formatted as follows:

`[COMMAND|SEQ_ID|LENGTH|DATA|CRC]`

COMMAND: The command name.
SEQ_ID: The sequence ID is a 32-bit unsigned integer represented in an 8-character hexadecimal string, 1-FFFFFFFF.  ID’s should be applied to commands sequentially and reset back to 01 after FFFFFFFF. For example a sequence ID value of 0x71FC3CCB shall be represented in the packet as 71FC3CCB.
LENGTH: The length of the data section of the packet.  If no data section is used the length should be 0.
DATA: The payload of the packet.  Only some of the commands will require a data section.  The maximum length of the data section is 64 bytes. The data may be comma delimited. 
CRC: The CRC is optional, but if it is included in the packet is should be enforced.  The CRC shall be a 32-bit CRC, represented in the command as an 8-character hexadecimal string.  For example a CRC value of 0x71FC3CCB shall be represented in the packet as 71FC3CCB.

The commands are using all ASCII characters.
Allowable characters are: `'A'-'Z'`, `'0'-'9'`, `'-'`, `'_'`, `.`, and `<CR>` and `<LF>` 
The `<CR>` and `<LF>` can optionally be placed after the packet to improve human readability.


# Workflow
This is a workflow diagram of the commands transferred between the HayStack and HayHub during an ideal imaging process. The following processes occur:
1.	The HayStack sends a Ready with or without Tray Event serial packet to the HayHub. 
2.	The HayHub will request the Haystack ID
3.	The Haystack will reply with its Unique Haystack ID
4.	The HayHub sends a Set Ready serial packet to the HayStack to set it in Ready Mode.
5.	The HayStack waits for a button press.
6.	The HayStack sends a Button Press Event serial packet to the HayHub.
7.	The HayStack moves its motors and positions the needle for imaging. 
8.	The HayStack sends the Image 1 Ready serial packet to the HayHub. 
9.	The HayHub takes an image.
10.	The HayHub sends the Image 1 Done serial packet to the HayStack.
11.	The HayStack moves the needle to the sharps container. 
12.	The HayStack sends the Image 2 Ready serial packet to the HayHub. 
13.	The HayHub takes an image.
14.	The HayHub sends the Image 2 Done serial packet to the HayStack.
15.	The HayStack sends a Ready Event serial packet to the HayHub.

# Error Table
| Error Description                                        | Error Command Message     | Heartbeat Error Hex Byte Value |
|----------------------------------------------------------|--------------------------|-------------------------------|
| Linear Motor could not be reset to home position.        | "LINEAR MOTOR"           | 0x01                          |
| Rotation Motor could not be reset to Home Position       | "ROTATION MOTOR"         | 0x02                          |
| Home Travel Sensor Error                                 | "HOME SENSOR"            | 0x03                          |
| End Travel Sensor Error                                  | "END SENSOR"             | 0x04                          |
| Calibration Sensor Error                                 | "CALIBRATION SENSOR"     | 0x05                          |
| Linear Motor stalled                                     | "LINEAR MOTOR STALL"     | 0x06                          |
| Rotation Motor Stalled                                   | "ROTATE MOTOR STALL"     | 0x07                          |
| Stepper Motor Movement Timeout for next position         | "TIMEOUT"                | 0x08                          |
| Unexpected Position                                      | "INCORRECT POS"          | 0x09                          |
| Stepper Motor is still in motion when not expected.      | "STEPPER IN MOTION"      | 0x0A                          |
| Induction Button communication error                     | "DROP AREA BTN"          | 0x0B                          |
| Capacitive Button communication error                    | "TOWER CAP BTN"          | 0x0C                          |

# Heartbeat Info
| Byte | Bit 7      | Bit 6     | Bit 5     | Bit 4     | Bit 3 | Bit 2 | Bit 1 | Bit 0     |
|------|------------|-----------|-----------|-----------|-------|-------|-------|-----------|
| HBD1 | CHG        | HC        | RDY       | MAGNET    | —     | —     | —     | ERROR     |
| HBD2 | ERROR VALUE (8 bits: see Error Table)  |       |       |       |       |           |
| HBD3 | Reserved for future use (8 bits)       |       |       |       |       |           |
| HBD4 | —          | —         | —         | — | BTN1 LED | BTN3 LED | BTN3 LED | BTN4 LED |

**Legend:**

- **Bits** are numbered from 7 (MSB, leftmost) to 0 (LSB, rightmost).
- **CHG** (Bit 7, HBD1): Change Indicator. Set to 1 if something has changed since the last heartbeat. Keep sending until ACK is received for this bit.
- **HC** (Bit 6, HBD1): Hay Container Status. 1 = Installed, 0 = Not Installed.
- **RDY** (Bit 5, HBD1): Haystack Status. 1 = Ready, 0 = Not Ready.
- **MAGNET** (Bit 4, HBD1): Status of Magnet Location Error. 0 = No Error, 1 = Error.
- **ERROR** (Bit 0, HBD1): Error Occurred. 1 = Error occurred, 0 = No Errors.
- **ERROR VALUE** (HBD2): 8-bit value indicating type of error (refer to Error Table).
- **HBD3**: Entire byte reserved for future use.
- **HBD4**:  
    - Bit 4: BTN1_LED  
    - Bit 3: BTN2_LED  
    - Bit 2: BTN3_LED  
    - Bit 1: BTN4_LED  
    Button LED Illumination Status. 1 = ON, 0 = OFF.
    Bits not assigned are reserved; set to 0.

# Commands
## ACK
## Error
## EVENT
## GET
## HEARTBEAT
## IMAGE
## INIT
## STATUS
## BTN_LED  
## LED
## SET
## RESET
## HAYSTACK_ID
## VERSION
## SET_PHASE
## INDICATE
## LED_EFFECT
## ILLUMINATOR
## CAP_BTN_INDICATE
